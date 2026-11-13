/**
 * Handing an identity over (ADR-0014 D9).
 *
 * The identity gets an address of its own, chosen by whoever accepts, and the
 * row that says who holds it is deleted. From then on it is an ordinary
 * account, and its former holder has no way in.
 *
 * THE OFFER IS A LINK, as a page set up for someone is (ADR-0004): holding the
 * link is the whole credential. The token is shown to the holder once and only
 * its SHA-256 is stored, so the database never holds anything that can take an
 * account.
 *
 * THE ORDER OF ACCEPTANCE IS THE SAFETY PROPERTY. The link to the holder is
 * deleted BEFORE the identity is given its new address. If the second step
 * fails, the link is put back and nothing has changed. The other order would
 * leave, on a failure, an identity that has a new owner and is still one
 * switch away from the old one. An address that already has an account is
 * refused before the link is cut, so a refusal changes nothing at all.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import { DATABASE_TABLES } from '@/config/database-tables';
import { HANDOVER_TTL_DAYS, isUnreachableEmail } from '@/config/identities';
import { callRpc, looseClient } from '@/lib/supabase/untyped';
import { normalizeEmail } from '@/services/auth/emailCode';
import { logger } from '@/utils/logger';
import { circleForCaller, type Caller, type IdentityResult } from './service';

const fail = (
  reason: Extract<IdentityResult<never>, { ok: false }>['reason'],
  message?: string
): IdentityResult<never> => ({ ok: false, reason, message });

/** What is stored for a token: never the token. */
export function hashHandoverToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface OpenHandover {
  identityId: string;
  expiresAt: string;
}

/** The open offers for the identities in this caller's circle. */
export async function listHandovers(
  admin: SupabaseClient,
  caller: Caller
): Promise<OpenHandover[]> {
  const circle = await circleForCaller(admin, caller);
  const ids = circle.members.filter(m => !m.isHolder).map(m => m.id);
  if (circle.withheld || ids.length === 0) {
    return [];
  }
  const { data } = await looseClient(admin)
    .from(DATABASE_TABLES.IDENTITY_HANDOVERS)
    .select('identity_user_id, expires_at')
    .in('identity_user_id', ids)
    .gt('expires_at', new Date().toISOString());
  return ((data ?? []) as Array<{ identity_user_id: string; expires_at: string }>).map(r => ({
    identityId: r.identity_user_id,
    expiresAt: r.expires_at,
  }));
}

/**
 * Offer an identity. Returns the token, once: it is not stored and cannot be
 * shown again, only replaced by offering again.
 */
export async function offerHandover(
  admin: SupabaseClient,
  caller: Caller,
  identityId: string
): Promise<IdentityResult<{ token: string; expiresAt: string }>> {
  const circle = await circleForCaller(admin, caller);
  const target = circle.members.find(m => m.id === identityId);
  if (circle.withheld || !target) {
    logger.warn(
      'Handover offer refused: not in circle',
      { userId: caller.userId, identityId },
      'Identities'
    );
    return fail('not_in_circle');
  }
  if (target.isHolder) {
    return fail('is_holder');
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + HANDOVER_TTL_DAYS * 86_400_000).toISOString();
  const db = looseClient(admin);

  // Offering again replaces the last link: the old one stops working.
  await db.from(DATABASE_TABLES.IDENTITY_HANDOVERS).delete().eq('identity_user_id', identityId);
  const { error } = await db.from(DATABASE_TABLES.IDENTITY_HANDOVERS).insert({
    identity_user_id: identityId,
    offered_by: circle.holderId,
    token_hash: hashHandoverToken(token),
    expires_at: expiresAt,
  });
  if (error) {
    logger.error('Handover offer failed', { error, identityId }, 'Identities');
    return fail('failed');
  }
  logger.info('Identity offered for handover', { identityId }, 'Identities');
  return { ok: true, data: { token, expiresAt } };
}

/** Withdraw an open offer. The link stops working. */
export async function cancelHandover(
  admin: SupabaseClient,
  caller: Caller,
  identityId: string
): Promise<IdentityResult<{ id: string }>> {
  const circle = await circleForCaller(admin, caller);
  if (circle.withheld || !circle.members.some(m => m.id === identityId && !m.isHolder)) {
    return fail('not_in_circle');
  }
  const { error } = await looseClient(admin)
    .from(DATABASE_TABLES.IDENTITY_HANDOVERS)
    .delete()
    .eq('identity_user_id', identityId);
  if (error) {
    return fail('failed');
  }
  return { ok: true, data: { id: identityId } };
}

interface HandoverRow {
  identity_user_id: string;
  offered_by: string;
  expires_at: string;
}

async function findOpenHandover(admin: SupabaseClient, token: string): Promise<HandoverRow | null> {
  if (!token || token.length > 200) {
    return null;
  }
  const { data } = await looseClient(admin)
    .from(DATABASE_TABLES.IDENTITY_HANDOVERS)
    .select('identity_user_id, offered_by, expires_at')
    .eq('token_hash', hashHandoverToken(token))
    .maybeSingle();
  const row = data as HandoverRow | null;
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    return null;
  }
  return row;
}

/**
 * What the accept page shows: which identity is on offer. Nothing about who
 * offers it. Null for an unknown, withdrawn or expired link, all alike.
 */
export async function previewHandover(
  admin: SupabaseClient,
  token: string
): Promise<{ name: string | null; username: string | null } | null> {
  const row = await findOpenHandover(admin, token);
  if (!row) {
    return null;
  }
  const { data } = await looseClient(admin)
    .from(DATABASE_TABLES.PROFILES)
    .select('name, username')
    .eq('id', row.identity_user_id)
    .maybeSingle();
  return {
    name: (data?.name as string | null | undefined) ?? null,
    username: (data?.username as string | null | undefined) ?? null,
  };
}

export type AcceptFailure = 'gone' | 'invalid_email' | 'email_taken' | 'failed';

/**
 * Accept an offer: the identity becomes an ordinary account on `email`, with
 * no way in left for its former holder, and the address to sign the new owner
 * in with is returned.
 *
 * Order, each step chosen so a failure leaves the holder holding the identity:
 *  1. Spend the offer: delete it by its token, atomically. A link that was
 *     withdrawn or replaced a moment ago finds nothing, and two people opening
 *     the same link cannot both get past here.
 *  2. Cut the link to the holder. From now on no switch reaches the identity.
 *  3. Remove every way in the holder could have put on it: sessions, second
 *     factors, passkeys, linked sign-in providers (identity_strip_ways_in),
 *     the connected apps' tokens and consents, and the password, replaced by
 *     one nobody knows.
 *  4. Give it its new address. Last, because it is the one step that hands
 *     the account to someone else.
 * Before step 4, any failure puts the link and the offer back.
 */
/** The account that has this address, if any (service role only). */
async function accountWithEmail(
  admin: SupabaseClient,
  email: string
): Promise<{ id: string | null; error: boolean }> {
  const { data, error } = (await callRpc(admin, 'auth_user_id_for_email', {
    p_email: email,
  })) as { data: string | null; error: { message: string } | null };
  if (error) {
    logger.error('Could not look up an address', { error: error.message }, 'Identities');
    return { id: null, error: true };
  }
  return { id: data ?? null, error: false };
}

export async function acceptHandover(
  admin: SupabaseClient,
  token: string,
  rawEmail: unknown,
  deps: { revokeApps: (userId: string) => Promise<unknown> }
): Promise<{ ok: true; identityId: string; email: string } | { ok: false; reason: AcceptFailure }> {
  const email = normalizeEmail(rawEmail);
  if (!email || isUnreachableEmail(email)) {
    return { ok: false, reason: 'invalid_email' };
  }
  if (!token || token.length > 200) {
    return { ok: false, reason: 'gone' };
  }
  const db = looseClient(admin);
  const tokenHash = hashHandoverToken(token);

  // 1. Spend the offer.
  const { data: spent, error: spendError } = await db
    .from(DATABASE_TABLES.IDENTITY_HANDOVERS)
    .delete()
    .eq('token_hash', tokenHash)
    .gt('expires_at', new Date().toISOString())
    .select('identity_user_id, offered_by, expires_at');
  if (spendError) {
    logger.error('Handover could not spend the offer', { error: spendError }, 'Identities');
    return { ok: false, reason: 'failed' };
  }
  const row = ((spent ?? []) as HandoverRow[])[0];
  if (!row) {
    return { ok: false, reason: 'gone' };
  }
  const identityId = row.identity_user_id;

  const reoffer = async () => {
    await db.from(DATABASE_TABLES.IDENTITY_HANDOVERS).insert({
      identity_user_id: identityId,
      offered_by: row.offered_by,
      token_hash: tokenHash,
      expires_at: row.expires_at,
    });
  };
  const relink = async (): Promise<boolean> => {
    const { error } = await db
      .from(DATABASE_TABLES.IDENTITY_LINKS)
      .insert({ identity_user_id: identityId, holder_user_id: row.offered_by });
    if (error) {
      logger.error(
        'Handover failed AND the link could not be restored: this identity has no holder and no address',
        { identityId, holderId: row.offered_by, error },
        'Identities'
      );
      return false;
    }
    await reoffer();
    return true;
  };

  // 2. Refuse an address that already has an account, before anything else
  // changes. The auth server would refuse it too, but only at the last step,
  // after the ways in are gone, and in words that differ between versions.
  const owner = await accountWithEmail(admin, email);
  if (owner.error) {
    await reoffer();
    logger.error('Handover could not check the address', { identityId }, 'Identities');
    return { ok: false, reason: 'failed' };
  }
  if (owner.id && owner.id !== identityId) {
    await reoffer();
    return { ok: false, reason: 'email_taken' };
  }

  // 3. Cut the link.
  const { data: cut, error: cutError } = await db
    .from(DATABASE_TABLES.IDENTITY_LINKS)
    .delete()
    .eq('identity_user_id', identityId)
    .eq('holder_user_id', row.offered_by)
    .select('identity_user_id');
  if (cutError || ((cut ?? []) as unknown[]).length !== 1) {
    // Nothing was changed but the offer; give it back unless the link is gone
    // for good (the identity deleted), in which case the offer is meaningless.
    if (!cutError) {
      return { ok: false, reason: 'gone' };
    }
    await reoffer();
    logger.error('Handover could not cut the link', { error: cutError, identityId }, 'Identities');
    return { ok: false, reason: 'failed' };
  }

  // 4. Remove every way in.
  try {
    const { error: stripError } = (await callRpc(admin, 'identity_strip_ways_in', {
      p_user_id: identityId,
    })) as { error: { message: string } | null };
    if (stripError) {
      throw new Error(stripError.message);
    }
    await deps.revokeApps(identityId);
    const { error: passwordError } = await admin.auth.admin.updateUserById(identityId, {
      password: randomBytes(32).toString('base64url'),
    });
    if (passwordError) {
      throw new Error(passwordError.message);
    }
  } catch (error) {
    logger.error(
      "Handover could not remove the former holder's ways in",
      { error, identityId },
      'Identities'
    );
    await relink();
    return { ok: false, reason: 'failed' };
  }

  // 5. The new address.
  const { error: emailError } = await admin.auth.admin.updateUserById(identityId, {
    email,
    email_confirm: true,
  });
  if (emailError) {
    // An error is not always a refusal: the request can fail after the auth
    // server applied it. Look before putting the link back on an account that
    // may already be someone else's.
    const { data: now } = await admin.auth.admin.getUserById(identityId);
    if (now?.user?.email?.toLowerCase() !== email) {
      // Taken in the moment since step 2, or refused for another reason.
      const since = await accountWithEmail(admin, email);
      const taken =
        (since.id !== null && since.id !== identityId) ||
        emailError.code === 'email_exists' ||
        /already|exists|registered/i.test(emailError.message ?? '');
      logger.warn(
        'Handover refused by the auth server',
        { code: emailError.code, identityId },
        'Identities'
      );
      await relink();
      return { ok: false, reason: taken ? 'email_taken' : 'failed' };
    }
  }

  await db.from(DATABASE_TABLES.PROFILES).update({ email }).eq('id', identityId);
  logger.info('Identity handed over', { identityId }, 'Identities');
  return { ok: true, identityId, email };
}
