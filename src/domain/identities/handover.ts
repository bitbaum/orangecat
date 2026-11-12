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
 * switch away from the old one.
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
 * Accept an offer: the identity becomes an ordinary account on `email`, and
 * its former holder's sessions in it are ended. Returns the address to sign
 * the new owner in with.
 */
export async function acceptHandover(
  admin: SupabaseClient,
  token: string,
  rawEmail: unknown
): Promise<{ ok: true; identityId: string; email: string } | { ok: false; reason: AcceptFailure }> {
  const email = normalizeEmail(rawEmail);
  if (!email || isUnreachableEmail(email)) {
    return { ok: false, reason: 'invalid_email' };
  }
  const row = await findOpenHandover(admin, token);
  if (!row) {
    return { ok: false, reason: 'gone' };
  }
  const identityId = row.identity_user_id;
  const db = looseClient(admin);

  // 1. Cut the link. The trigger removes the offer with it, so the token is
  //    spent from here on, whatever happens next.
  const { data: cut, error: cutError } = await db
    .from(DATABASE_TABLES.IDENTITY_LINKS)
    .delete()
    .eq('identity_user_id', identityId)
    .eq('holder_user_id', row.offered_by)
    .select('identity_user_id');
  if (cutError || ((cut ?? []) as unknown[]).length !== 1) {
    logger.error('Handover could not cut the link', { error: cutError, identityId }, 'Identities');
    return { ok: false, reason: 'failed' };
  }

  // 2. Give the identity its own address.
  const { error: emailError } = await admin.auth.admin.updateUserById(identityId, {
    email,
    email_confirm: true,
  });
  if (emailError) {
    // Put everything back: the holder keeps the identity and the link works
    // again, so the person can try another address.
    const { error: relinkError } = await db
      .from(DATABASE_TABLES.IDENTITY_LINKS)
      .insert({ identity_user_id: identityId, holder_user_id: row.offered_by });
    if (relinkError) {
      logger.error(
        'Handover failed AND the link could not be restored: this identity has no holder and no address',
        { identityId, holderId: row.offered_by, relinkError },
        'Identities'
      );
      return { ok: false, reason: 'failed' };
    }
    await db.from(DATABASE_TABLES.IDENTITY_HANDOVERS).insert({
      identity_user_id: identityId,
      offered_by: row.offered_by,
      token_hash: hashHandoverToken(token),
      expires_at: row.expires_at,
    });
    const taken = /already|exists|registered/i.test(emailError.message ?? '');
    logger.warn(
      'Handover refused by the auth server',
      { code: emailError.code, identityId },
      'Identities'
    );
    return { ok: false, reason: taken ? 'email_taken' : 'failed' };
  }

  // 3. End the former holder's sessions in the account. They came from
  //    switches; none of them is the new owner's.
  const { error: endError } = (await callRpc(admin, 'end_sessions_of', {
    p_user_ids: [identityId],
  })) as { error: { message: string } | null };
  if (endError) {
    logger.error(
      'Handed-over identity: former sessions could not be ended',
      { error: endError.message, identityId },
      'Identities'
    );
  }

  await db.from(DATABASE_TABLES.PROFILES).update({ email }).eq('id', identityId);
  logger.info('Identity handed over', { identityId }, 'Identities');
  return { ok: true, identityId, email };
}
