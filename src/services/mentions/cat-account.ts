/**
 * The Cat's account — created once, then re-asserted.
 *
 * The Cat is a real profile rather than a rendering convention, which is what
 * lets a Cat reply be an ordinary `messages` or `timeline_events` row: read
 * receipts, search, deletion, threading, moderation and realtime all work on it
 * without a single branch. The cost of that is exactly this file — something has
 * to create the row.
 *
 * Idempotent by design, and cheap when it is a no-op: one indexed lookup. It is
 * safe to call on every worker tick, and doing so makes the account
 * self-healing — if the profile is ever deleted OR RENAMED, the Cat comes back
 * rather than every `@cat` on the platform quietly resolving to nobody.
 *
 * The rename half was learned in production. This file used to FIND the Cat by
 * its username, which is the one field about the Cat that another policy is
 * entitled to change: on 2026-08-26 the email-derived-handle retirement renamed
 * `cat` to `user_0234d5e38e66` (see
 * supabase/migrations/20260828070000_system_accounts_keep_their_handles.sql).
 * The lookup then missed, creation said "already registered", the second lookup
 * missed too, and this returned null on every tick thereafter — self-healing
 * that could not heal, because the thing it searched by was the thing that
 * broke. Identity is now keyed on the login address, which is a literal in this
 * file and cannot be reassigned, and the handle is treated as a field to
 * ASSERT rather than a key to search by.
 */

import { CAT_USERNAME, CAT_DISPLAY_NAME } from '@/config/cat-identity';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The Cat's login address.
 *
 * `.invalid` is reserved by RFC 2606 and can never be delivered to or
 * registered by anyone, which matters more than it looks: an account's email is
 * its password-reset channel, so a bot identity with a routable address is a
 * bot identity somebody else can eventually take. This one has no password and
 * no reachable mailbox, so there is no credential to phish and no reset to
 * intercept.
 *
 * The local part is also load-bearing. `handle_new_user` derives the profile's
 * username from `split_part(email, '@', 1)`, so this address is what makes the
 * Cat's handle `cat` at creation time.
 */
const CAT_EMAIL = `${CAT_USERNAME}@orangecat.invalid`;

const CAT_BIO =
  'The OrangeCat agent. Tag @cat in a message or under a post and I will answer there.';

export interface CatAccount {
  id: string;
  username: string;
}

/**
 * @param admin a service-role client. Creating an auth user and writing another
 *   account's profile are both privileged, so this cannot run as the caller.
 * @returns the Cat's account, or null if it could not be established — callers
 *   must treat null as "do not attempt to speak as the Cat" rather than
 *   inventing a sender.
 */
export async function ensureCatAccount(
  admin: SupabaseClient
): Promise<CatAccount | null> {
  const existing = await findCatProfile(admin);
  if (existing) {
    return assertCatHandle(admin, existing);
  }

  // No profile. Either the auth user does not exist either, or it does and its
  // profile row was removed; both are handled by creating and then re-reading.
  const { error: createError } = await admin.auth.admin.createUser({
    email: CAT_EMAIL,
    email_confirm: true,
    // No password is set, so the account cannot be signed into with one.
    user_metadata: { full_name: CAT_DISPLAY_NAME },
  });

  // "already registered" is the expected race and the expected second run: the
  // auth user survives even when the profile row does not.
  if (createError && !/already|exists|registered/i.test(createError.message)) {
    logger.error('Could not create the Cat auth user', { error: createError.message }, 'CatAccount');
    return null;
  }

  // handle_new_user inserts the profile from the email local part, so the
  // username is already `cat`. Re-assert the presentation fields so a partially
  // created account converges rather than staying half-built.
  const profile = await findCatProfile(admin);
  if (!profile) {
    logger.error('Cat auth user exists but no profile row followed', {}, 'CatAccount');
    return null;
  }

  const { error: updateError } = await admin
    .from(DATABASE_TABLES.PROFILES)
    .update({ name: CAT_DISPLAY_NAME, bio: CAT_BIO })
    .eq('id', profile.id);

  if (updateError) {
    // The account exists and is usable; only its presentation is stale.
    logger.warn('Cat profile created but could not be described', { error: updateError.message }, 'CatAccount');
  }

  logger.info('Cat account established', { id: profile.id }, 'CatAccount');
  return assertCatHandle(admin, profile);
}

/**
 * Find the Cat by the one thing about it that cannot be reassigned.
 *
 * NOT by username. `@cat` is what the platform advertises, which makes the
 * handle the thing most worth repairing and therefore the worst possible thing
 * to search by — if it is wrong, the lookup that would notice returns nothing.
 * The login address is a literal in this file, belongs to a domain RFC 2606
 * guarantees nobody can receive mail at, and no product policy has any reason
 * to rewrite it.
 */
async function findCatProfile(admin: SupabaseClient): Promise<CatAccount | null> {
  const { data, error } = await admin
    .from(DATABASE_TABLES.PROFILES)
    .select('id, username')
    .eq('email', CAT_EMAIL)
    .maybeSingle();

  if (error) {
    logger.error('Could not look up the Cat profile', { error: error.message }, 'CatAccount');
    return null;
  }
  return data ? { id: data.id as string, username: data.username as string } : null;
}

/**
 * Make the account answer to `@cat`, whatever it currently says.
 *
 * A no-op on every ordinary tick — the comparison is free and the write only
 * happens when the handle has actually drifted. When it has, this is the whole
 * repair: the resolver looks mentions up by username, so restoring it is what
 * makes `@cat` mean the Cat again.
 *
 * A failure here is reported and swallowed rather than propagated. The account
 * still exists and the Cat can still WRITE under the wrong handle; refusing to
 * return it would turn a wrong name into total silence, which is strictly
 * worse. The mismatch is logged at error level because it means something
 * outside this file is renaming a system account.
 */
async function assertCatHandle(
  admin: SupabaseClient,
  profile: CatAccount
): Promise<CatAccount> {
  if (profile.username === CAT_USERNAME) {
    return profile;
  }

  logger.error(
    'The Cat is not answering to its own handle',
    { found: profile.username, expected: CAT_USERNAME },
    'CatAccount'
  );

  const { error } = await admin
    .from(DATABASE_TABLES.PROFILES)
    .update({ username: CAT_USERNAME })
    .eq('id', profile.id);

  if (error) {
    // The likeliest cause is the unique index: something else holds `cat`.
    // That is impersonation of the platform's own agent, so it is worth the
    // loud log even though the Cat keeps working under the wrong name.
    logger.error(
      'Could not restore the Cat handle',
      { error: error.message, holding: profile.username },
      'CatAccount'
    );
    return profile;
  }

  logger.info('Restored the Cat handle', { was: profile.username }, 'CatAccount');
  return { ...profile, username: CAT_USERNAME };
}
