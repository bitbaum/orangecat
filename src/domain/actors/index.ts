/**
 * Actor Domain Helpers
 *
 * ONE query for "which actor is this user", and two intents over it.
 *
 * There were five: this file, `getOrCreateUserActor`, and three byte-identical
 * inline copies in projectStore, the loans queries and the post composer. They
 * disagreed about the things that matter — whether a missing row means `null`
 * or means "create one", whether a database error is reported or swallowed, and
 * whether `actor_type` is filtered at all (this one did not, and depended on a
 * constraint it never mentioned).
 *
 * WHY THIS DOES NOT USE maybeSingle()
 *
 * Nothing makes a user's actor unique. `idx_actors_user_id` is a plain partial
 * index, not a unique one, so several `actor_type='user'` rows for one person
 * are possible — and on 2026-09-18 one account had six of them.
 *
 * PostgREST answers `maybeSingle()` with the SAME error code for "no rows" and
 * for "too many": HTTP 406, `PGRST116`, differing only in a human-readable
 * `details` string ("The result contains 0 rows" / "6 rows"). `getOrCreateUserActor`
 * tested `code !== 'PGRST116'` before creating, so "six rows" read as "none" and
 * it minted a seventh — which made the next lookup ambiguous too. The duplicates
 * were not a coincidence; the code manufactured them.
 *
 * So: order and take the first. That answers 0, 1 and many without a 406, it is
 * deterministic (the oldest actor wins, so a person's identity does not change
 * under them), and `getOrCreateUserActor` can only create when the row count is
 * genuinely zero.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '@/lib/supabase/untyped';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';

/** What the lookup found, distinguishing "nothing" from "the query failed". */
export type UserActorLookup =
  { ok: true; actorId: string | null; duplicates: number } | { ok: false; actorId: null };

/**
 * The one query. Callers that need to tell a failure from an absence use this;
 * everything else wants `getUserActorId` below.
 */
export async function lookupUserActor(
  supabase: AnySupabaseClient,
  userId: string
): Promise<UserActorLookup> {
  const { data, error } = (await fromTable(supabase, DATABASE_TABLES.ACTORS)
    .select('id')
    .eq('user_id', userId)
    .eq('actor_type', 'user')
    .order('created_at', { ascending: true })) as {
    data: Array<{ id: string }> | null;
    error: { message?: string } | null;
  };

  if (error) {
    // Previously swallowed. An outage that silently reads as "this person is
    // not the author" is its own bug, and it is invisible without this line.
    logger.error('Actor lookup failed', { error: error.message, userId }, 'Actors');
    return { ok: false, actorId: null };
  }

  const rows = data ?? [];
  if (rows.length > 1) {
    logger.warn(
      'User has more than one actor; using the oldest',
      { userId, count: rows.length },
      'Actors'
    );
  }

  return { ok: true, actorId: rows[0]?.id ?? null, duplicates: rows.length };
}

/**
 * The primary actor id for a user, or null.
 *
 * Null means BOTH "no actor" and "the lookup failed" — deliberately, because
 * every caller uses it to decide what this person may see or own, and failing
 * closed is the right default there. The failure is no longer silent: it is
 * logged in `lookupUserActor`.
 */
export async function getUserActorId(
  supabase: AnySupabaseClient,
  userId: string
): Promise<string | null> {
  const result = await lookupUserActor(supabase, userId);
  return result.actorId;
}
