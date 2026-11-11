/**
 * Identities — the names one person holds (ADR-0014).
 *
 * An identity is a whole account: its own auth user, profile, actor, wallet,
 * timeline and inbox. What makes it one of a person's identities is one private
 * row in `identity_links` naming the account that holds it. Nothing an identity
 * owns points at its holder, so the link cannot be read off any public row.
 *
 * THE CIRCLE is the holder plus every identity it holds. It is the whole of the
 * authority model: a session for any member may become a session for any other
 * member, and for nobody else. Every function here that acts on a target
 * resolves the caller's circle first and refuses a target outside it.
 *
 * The link table has no RLS policy, so everything here runs on the service
 * role. Callers pass the id of the SIGNED-IN user and never a holder id from a
 * request: the circle is derived, not claimed.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { DATABASE_TABLES } from '@/config/database-tables';
import {
  IDENTITY_EMAIL_DOMAIN,
  IDENTITY_NAME_MAX_LENGTH,
  MAX_IDENTITIES,
  isUnreachableEmail,
} from '@/config/identities';
import { looseClient } from '@/lib/supabase/untyped';
import { usernameSchema } from '@/lib/validation/base';
import { logger } from '@/utils/logger';

export interface CircleMember {
  id: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  /** The account that holds the others. Exactly one per circle. */
  isHolder: boolean;
}

export interface Circle {
  holderId: string;
  /** Holder first, then identities oldest first. */
  members: CircleMember[];
}

export type IdentityFailure =
  | 'not_in_circle'
  | 'limit_reached'
  | 'holder_needs_email'
  | 'invalid_name'
  | 'invalid_username'
  | 'username_taken'
  | 'is_holder'
  | 'is_current'
  | 'failed';

export type IdentityResult<T> =
  { ok: true; data: T } | { ok: false; reason: IdentityFailure; message?: string };

const fail = (reason: IdentityFailure, message?: string): IdentityResult<never> => ({
  ok: false,
  reason,
  message,
});

/** The circle `userId` belongs to. A person with no identities is a circle of one. */
export async function getCircle(admin: SupabaseClient, userId: string): Promise<Circle> {
  const db = looseClient(admin);

  const { data: asIdentity } = await db
    .from(DATABASE_TABLES.IDENTITY_LINKS)
    .select('holder_user_id')
    .eq('identity_user_id', userId)
    .maybeSingle();
  const holderId = (asIdentity?.holder_user_id as string | undefined) ?? userId;

  const { data: links } = await db
    .from(DATABASE_TABLES.IDENTITY_LINKS)
    .select('identity_user_id, created_at')
    .eq('holder_user_id', holderId)
    .order('created_at', { ascending: true });
  const identityIds = ((links ?? []) as Array<{ identity_user_id: string }>).map(
    l => l.identity_user_id
  );

  const ids = [holderId, ...identityIds];
  const { data: profiles } = await db
    .from(DATABASE_TABLES.PROFILES)
    .select('id, username, name, avatar_url')
    .in('id', ids);
  const byId = new Map(
    ((profiles ?? []) as Array<Record<string, string | null>>).map(p => [p.id as string, p])
  );

  return {
    holderId,
    members: ids.map(id => ({
      id,
      username: byId.get(id)?.username ?? null,
      name: byId.get(id)?.name ?? null,
      avatarUrl: byId.get(id)?.avatar_url ?? null,
      isHolder: id === holderId,
    })),
  };
}

/**
 * Whether the holder can always be returned to. Switching mints a session from
 * the target's email, and an anonymous account or one on an unreachable address
 * has none a person can also use to get in by themselves, so such a holder
 * could be locked out of the account that owns everything else.
 */
async function holderIsReachable(admin: SupabaseClient, holderId: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.getUserById(holderId);
  if (error || !data?.user) {
    return false;
  }
  const { email, is_anonymous: isAnonymous } = data.user;
  return !!email && !isAnonymous && !isUnreachableEmail(email);
}

/**
 * Create an identity for the caller's circle. Any member may add one; it is
 * always held by the holder, never by the identity that asked.
 */
export async function createIdentity(
  admin: SupabaseClient,
  userId: string,
  input: { name: unknown; username: unknown }
): Promise<IdentityResult<CircleMember>> {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > IDENTITY_NAME_MAX_LENGTH) {
    return fail('invalid_name');
  }
  const parsed = usernameSchema.safeParse(
    typeof input.username === 'string' ? input.username.trim() : ''
  );
  if (!parsed.success) {
    return fail('invalid_username', parsed.error.issues[0]?.message);
  }
  const username = parsed.data;

  const circle = await getCircle(admin, userId);
  if (circle.members.length - 1 >= MAX_IDENTITIES) {
    return fail('limit_reached');
  }
  if (!(await holderIsReachable(admin, circle.holderId))) {
    return fail('holder_needs_email');
  }

  const db = looseClient(admin);
  const { data: clash } = await db
    .from(DATABASE_TABLES.PROFILES)
    .select('id')
    .ilike('username', username)
    .limit(1);
  if (((clash ?? []) as unknown[]).length > 0) {
    return fail('username_taken');
  }

  // The address is random, not derived from the name: it must say nothing
  // about the identity and can never collide with a real one.
  const email = `identity-${randomBytes(9).toString('hex')}@${IDENTITY_EMAIL_DOMAIN}`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    // No password is set, so the account cannot be signed into with one.
    user_metadata: { full_name: name },
  });
  const identityId = created?.user?.id;
  if (createError || !identityId) {
    logger.error(
      'Could not create identity account',
      { error: createError?.message },
      'Identities'
    );
    return fail('failed');
  }

  // From here every failure removes the account again: an auth user with no
  // link is an account nobody can ever enter.
  const undo = async (why: string, error: unknown) => {
    logger.error(`Identity creation rolled back: ${why}`, { error, identityId }, 'Identities');
    await admin.auth.admin.deleteUser(identityId);
  };

  // handle_new_user has already inserted the profile. Give it the chosen
  // handle, and drop the unreachable address from the profile row.
  const { error: profileError } = await db
    .from(DATABASE_TABLES.PROFILES)
    .update({ username, name, email: null })
    .eq('id', identityId);
  if (profileError) {
    await undo('profile update', profileError);
    // 23505: someone took the handle between the check above and now.
    return fail((profileError as { code?: string }).code === '23505' ? 'username_taken' : 'failed');
  }

  const { error: linkError } = await db
    .from(DATABASE_TABLES.IDENTITY_LINKS)
    .insert({ identity_user_id: identityId, holder_user_id: circle.holderId });
  if (linkError) {
    await undo('link insert', linkError);
    // The database refuses past its own ceiling and refuses chains.
    return fail((linkError as { code?: string }).code === '23514' ? 'limit_reached' : 'failed');
  }

  logger.info('Identity created', { identityId }, 'Identities');
  return { ok: true, data: { id: identityId, username, name, avatarUrl: null, isHolder: false } };
}

/**
 * A one-time sign-in code for `targetId`, if the caller's circle contains it.
 *
 * GoTrue only generates the code here (admin generateLink sends nothing); the
 * route exchanges it on the caller's cookie-bound client, which replaces the
 * session. The same mechanism as sign-in by emailed code
 * (src/services/auth/emailCode.ts), minus the email.
 */
export async function mintSwitchCode(
  admin: SupabaseClient,
  userId: string,
  targetId: string
): Promise<IdentityResult<{ email: string; code: string }>> {
  const circle = await getCircle(admin, userId);
  if (!circle.members.some(m => m.id === targetId)) {
    // Logged: outside the UI this is someone probing for another account.
    logger.warn(
      'Identity switch refused: target not in circle',
      { userId, targetId },
      'Identities'
    );
    return fail('not_in_circle');
  }

  const { data: target, error: targetError } = await admin.auth.admin.getUserById(targetId);
  const email = target?.user?.email;
  if (targetError || !email) {
    return fail(targetId === circle.holderId ? 'holder_needs_email' : 'failed');
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const code = data?.properties?.email_otp;
  if (error || !code) {
    logger.error('Identity switch code refused', { code: error?.code, targetId }, 'Identities');
    return fail('failed');
  }
  return { ok: true, data: { email, code } };
}

/**
 * Delete an identity and everything it owns. Only identities: the holder's own
 * account is deleted through the account-deletion flow, which removes its
 * identities with it. The signed-in identity cannot delete itself here, so a
 * person always lands somewhere after the act.
 */
export async function deleteIdentity(
  admin: SupabaseClient,
  userId: string,
  targetId: string,
  beforeDelete: (identityId: string) => Promise<unknown>
): Promise<IdentityResult<{ id: string }>> {
  const circle = await getCircle(admin, userId);
  if (!circle.members.some(m => m.id === targetId)) {
    logger.warn(
      'Identity delete refused: target not in circle',
      { userId, targetId },
      'Identities'
    );
    return fail('not_in_circle');
  }
  if (targetId === circle.holderId) {
    return fail('is_holder');
  }
  if (targetId === userId) {
    return fail('is_current');
  }

  await beforeDelete(targetId);
  const { error } = await admin.auth.admin.deleteUser(targetId);
  if (error) {
    logger.error('Identity deletion failed', { error: error.message, targetId }, 'Identities');
    return fail('failed');
  }
  logger.info('Identity deleted', { targetId }, 'Identities');
  return { ok: true, data: { id: targetId } };
}

/**
 * Every account that must end when `userId`'s sessions end or its account is
 * deleted: the other members of the circle. A session for one member can become
 * a session for any other, so "sign out everywhere" that stopped at one account
 * would leave a stolen device one switch away from all of them.
 */
export async function otherCircleMemberIds(
  admin: SupabaseClient,
  userId: string
): Promise<string[]> {
  const circle = await getCircle(admin, userId);
  return circle.members.map(m => m.id).filter(id => id !== userId);
}

/** The identities a holder's deletion must take with it. Empty for an identity. */
export async function heldIdentityIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  const circle = await getCircle(admin, userId);
  if (circle.holderId !== userId) {
    return [];
  }
  return circle.members.filter(m => !m.isHolder).map(m => m.id);
}
