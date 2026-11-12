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
import { countUnreadNotifications } from '@/services/notifications/unread-count';
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
  /**
   * True when the caller is an identity that may no longer use its circle
   * (see circleForCaller). It then stands alone, and holds nothing.
   */
  withheld?: boolean;
  /**
   * The asked-about account is an identity that has had a way in of its own
   * (its email or password changed). Permanent, set by the database
   * (identity_links.lost_circle_at).
   */
  lostCircle?: boolean;
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

export const fail = (reason: IdentityFailure, message?: string): IdentityResult<never> => ({
  ok: false,
  reason,
  message,
});

/**
 * Who is asking. `sessionMethods` are the `amr` methods of the caller's own
 * session (how it was signed in), read from the verified access token.
 */
export interface Caller {
  userId: string;
  sessionMethods: string[];
}

/**
 * The only ways a session for an identity can come to exist while the identity
 * is still its holder's alone: a switch, which is a server-side exchange of a
 * one-time code. Refreshing, or adding a second factor, does not change that.
 */
const SWITCH_SESSION_METHODS: ReadonlySet<string> = new Set(['otp', 'magiclink', 'recovery']);
const NEUTRAL_SESSION_METHODS: ReadonlySet<string> = new Set(['token_refresh', 'totp', 'mfa/totp']);

/**
 * The circle this CALLER may use.
 *
 * A holder always has its circle. An identity has it only while it is still
 * the holder's alone: on its unreachable address, in a session that came from a
 * switch. An identity can be given a password, a passkey or a real address from
 * its own settings, and its login can then be handed to someone else. Without
 * this gate that person would be one request away from the holder's main
 * account and every other identity. With it, an identity that has a way in of
 * its own stands alone: it cannot switch, list, create, delete or sign the
 * others out.
 */
export async function circleForCaller(admin: SupabaseClient, caller: Caller): Promise<Circle> {
  const circle = await getCircle(admin, caller.userId);
  if (circle.holderId === caller.userId) {
    return circle;
  }

  const alone: Circle = {
    holderId: caller.userId,
    members: circle.members
      .filter(m => m.id === caller.userId)
      .map(m => ({ ...m, isHolder: false })),
    withheld: true,
  };

  // Once an identity has had a way in of its own it never has its circle
  // again, whatever its address or session looks like now.
  if (circle.lostCircle) {
    logger.warn(
      'Identity has had a way in of its own; circle withheld',
      { userId: caller.userId },
      'Identities'
    );
    return alone;
  }

  const methods = caller.sessionMethods.filter(m => !NEUTRAL_SESSION_METHODS.has(m));
  const fromSwitch = methods.length > 0 && methods.every(m => SWITCH_SESSION_METHODS.has(m));
  if (!fromSwitch) {
    logger.warn(
      'Identity session did not come from a switch; circle withheld',
      { userId: caller.userId, methods: caller.sessionMethods },
      'Identities'
    );
    return alone;
  }

  const { data, error } = await admin.auth.admin.getUserById(caller.userId);
  if (error || !isUnreachableEmail(data?.user?.email)) {
    logger.warn(
      'Identity has an address of its own; circle withheld',
      { userId: caller.userId },
      'Identities'
    );
    return alone;
  }
  return circle;
}

/**
 * The circle `userId` belongs to. A person with no identities is a circle of one.
 *
 * Throws when the links cannot be read. Read as "no identities", a failed read
 * made account deletion orphan every identity and sign-out-everywhere report
 * success without reaching them.
 */
export async function getCircle(admin: SupabaseClient, userId: string): Promise<Circle> {
  const db = looseClient(admin);

  const { data: asIdentity, error: asIdentityError } = await db
    .from(DATABASE_TABLES.IDENTITY_LINKS)
    .select('holder_user_id, lost_circle_at')
    .eq('identity_user_id', userId)
    .maybeSingle();
  if (asIdentityError) {
    throw new Error(`Could not read the identity link of ${userId}: ${asIdentityError.message}`);
  }
  const holderId = (asIdentity?.holder_user_id as string | undefined) ?? userId;
  const lostCircle = Boolean(asIdentity?.lost_circle_at);

  const { data: links, error: linksError } = await db
    .from(DATABASE_TABLES.IDENTITY_LINKS)
    .select('identity_user_id, created_at')
    .eq('holder_user_id', holderId)
    .order('created_at', { ascending: true });
  if (linksError) {
    throw new Error(`Could not read the identities of ${holderId}: ${linksError.message}`);
  }
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
    lostCircle,
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
  caller: Caller,
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

  const circle = await circleForCaller(admin, caller);
  if (circle.withheld) {
    return fail('not_in_circle');
  }
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
    // Escaped: '_' is a wildcard to ILIKE and is allowed in a handle, so
    // 'a_b' would otherwise match 'axb' and refuse a free handle.
    .ilike(
      'username',
      username.replace(/[\\%_]/g, c => `\\${c}`)
    )
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

  // The limit is checked before creating, so two creates at the same moment
  // could both pass it. Count again now that this one exists, and give way if
  // it is past the limit in creation order (the database's own, higher
  // ceiling is the backstop behind this).
  const { data: held, error: heldError } = await db
    .from(DATABASE_TABLES.IDENTITY_LINKS)
    .select('identity_user_id')
    .eq('holder_user_id', circle.holderId)
    .order('created_at', { ascending: true })
    .order('identity_user_id', { ascending: true });
  const position = ((held ?? []) as Array<{ identity_user_id: string }>).findIndex(
    l => l.identity_user_id === identityId
  );
  if (heldError || position < 0 || position >= MAX_IDENTITIES) {
    await db.from(DATABASE_TABLES.IDENTITY_LINKS).delete().eq('identity_user_id', identityId);
    await undo('over the limit after a concurrent create', heldError);
    return fail(heldError ? 'failed' : 'limit_reached');
  }

  logger.info('Identity created', { identityId }, 'Identities');
  return { ok: true, data: { id: identityId, username, name, avatarUrl: null, isHolder: false } };
}

/**
 * Delete an identity and everything it owns. Only identities: the holder's own
 * account is deleted through the account-deletion flow, which removes its
 * identities with it. The signed-in identity cannot delete itself here, so a
 * person always lands somewhere after the act.
 */
export async function deleteIdentity(
  admin: SupabaseClient,
  caller: Caller,
  targetId: string,
  beforeDelete: (identityId: string) => Promise<unknown>
): Promise<IdentityResult<{ id: string }>> {
  const userId = caller.userId;
  const circle = await circleForCaller(admin, caller);
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
  caller: Caller
): Promise<string[]> {
  const circle = await circleForCaller(admin, caller);
  return circle.members.map(m => m.id).filter(id => id !== caller.userId);
}

/**
 * How much waits for the person in each of the caller's OTHER identities
 * (ADR-0014 D8): the same unread count the bell shows, read for accounts the
 * caller is not signed in to. That crossing is why it lives here: it is only
 * ever answered for the members of the caller's own circle, on the service
 * role. A count that cannot be read is left out rather than shown as zero.
 */
export async function waitingByMember(
  admin: SupabaseClient,
  caller: Caller
): Promise<Record<string, number>> {
  const circle = await circleForCaller(admin, caller);
  const others = circle.members.filter(m => m.id !== caller.userId);
  const counts = await Promise.all(
    others.map(async member => {
      try {
        return [member.id, await countUnreadNotifications(admin, member.id)] as const;
      } catch (error) {
        logger.warn('Could not count what waits for an identity', { error }, 'Identities');
        return null;
      }
    })
  );
  return Object.fromEntries(counts.filter((entry): entry is readonly [string, number] => !!entry));
}

/** The identities a holder's deletion must take with it. Empty for an identity. */
export async function heldIdentityIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  const circle = await getCircle(admin, userId);
  if (circle.holderId !== userId) {
    return [];
  }
  return circle.members.filter(m => !m.isHolder).map(m => m.id);
}
