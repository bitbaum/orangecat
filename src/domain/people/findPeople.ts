/**
 * Who you can pay or ask — your circle first, then everyone with a handle.
 *
 * Read with the caller's own client: profiles and follows are public rows,
 * and payment_requests shows a person only the asks they are party to.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { PEOPLE_FIND_LIMIT, type PersonRelation } from '@/config/people';
import { FIXTURE_USERNAME_ILIKE_PATTERNS, isFixtureUsername } from '@/config/public-directory';
import { escapeLike } from '@/lib/db/likePattern';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { rankPeople, type FoundPerson } from './rankPeople';

export type { FoundPerson };

interface ProfileRow {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
}

const PROFILE_COLUMNS = 'id, username, name, avatar_url';
/** Enough circle for anyone here today; a bigger circle is paged by the search instead. */
const CIRCLE_LIMIT = 200;
const RECENT_REQUESTS = 100;
const SEARCH_CANDIDATES = 40;

/** A PostgREST filter value, quoted so commas and parentheses in a name stay text. */
const quoted = (pattern: string) => `"${pattern.replace(/["\\]/g, '\\$&')}"`;

export async function findPeople(
  supabase: AnySupabaseClient,
  viewerId: string,
  query: string,
  limit: number = PEOPLE_FIND_LIMIT
): Promise<FoundPerson[]> {
  const typed = query.trim().replace(/^@/, '');

  const [followingRes, followersRes, requestsRes] = await Promise.all([
    supabase
      .from(DATABASE_TABLES.FOLLOWS)
      .select('following_id')
      .eq('follower_id', viewerId)
      .order('created_at', { ascending: false })
      .limit(CIRCLE_LIMIT),
    supabase
      .from(DATABASE_TABLES.FOLLOWS)
      .select('follower_id')
      .eq('following_id', viewerId)
      .order('created_at', { ascending: false })
      .limit(CIRCLE_LIMIT),
    supabase
      .from(DATABASE_TABLES.PAYMENT_REQUESTS)
      .select('requester_id, payer_id')
      .or(`requester_id.eq.${viewerId},payer_id.eq.${viewerId}`)
      .order('created_at', { ascending: false })
      .limit(RECENT_REQUESTS),
  ]);

  const following = new Set<string>(
    ((followingRes.data ?? []) as Array<{ following_id: string }>).map(r => r.following_id)
  );
  const followers = new Set<string>(
    ((followersRes.data ?? []) as Array<{ follower_id: string }>).map(r => r.follower_id)
  );
  const requested = new Set<string>();
  for (const r of (requestsRes.data ?? []) as Array<{ requester_id: string; payer_id: string }>) {
    requested.add(r.requester_id === viewerId ? r.payer_id : r.requester_id);
  }
  const relationOf = (id: string): PersonRelation =>
    following.has(id) && followers.has(id)
      ? 'mutual'
      : following.has(id)
        ? 'following'
        : followers.has(id)
          ? 'follower'
          : requested.has(id)
            ? 'requested'
            : 'none';

  const circleIds = [...new Set([...following, ...followers, ...requested])].filter(
    id => id !== viewerId
  );

  // Each read resolves to its rows; the builders' own types are not carried
  // past this point (deep enough to stall tsc when chained in a loop).
  const rows = async (q: unknown): Promise<ProfileRow[]> => {
    const r = await (q as PromiseLike<{ data: unknown }>);
    return (r.data ?? []) as ProfileRow[];
  };
  const reads: Array<Promise<ProfileRow[]>> = [];
  if (circleIds.length > 0) {
    reads.push(
      rows(supabase.from(DATABASE_TABLES.PROFILES).select(PROFILE_COLUMNS).in('id', circleIds))
    );
  }
  if (typed) {
    const fragment = escapeLike(typed);
    const matching = supabase
      .from(DATABASE_TABLES.PROFILES)
      .select(PROFILE_COLUMNS)
      .neq('id', viewerId)
      .not('username', 'is', null)
      .or(`username.ilike.${quoted(`${fragment}%`)},name.ilike.${quoted(`%${fragment}%`)}`)
      .limit(SEARCH_CANDIDATES);
    // CI's own fixture accounts are kept out in the query, so they cannot
    // fill the candidate page before a real person is reached. The chain is
    // held as unknown between steps: the builder's own type, re-derived on
    // every `.not`, is deep enough to stall tsc.
    let search: unknown = matching;
    for (const pattern of FIXTURE_USERNAME_ILIKE_PATTERNS) {
      search = (search as typeof matching).not('username', 'ilike', pattern);
    }
    reads.push(rows(search));
  }

  const seen = new Set<string>();
  const people: FoundPerson[] = [];
  for (const found of await Promise.all(reads)) {
    for (const row of found) {
      if (
        !row.username ||
        seen.has(row.id) ||
        row.id === viewerId ||
        isFixtureUsername(row.username)
      ) {
        continue;
      }
      seen.add(row.id);
      people.push({
        id: row.id,
        username: row.username,
        name: row.name?.trim() || null,
        avatarUrl: row.avatar_url || null,
        relation: relationOf(row.id),
      });
    }
  }

  return rankPeople(typed, people).slice(0, limit);
}
