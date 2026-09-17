/**
 * What the reader has done to a post, and what everyone else has.
 *
 * This existed nowhere. `likesCount` and `userLiked` were hardcoded to
 * `0`/`false` in eventQueries under a comment saying the UI enriched them
 * later — nothing did — and userFeeds read them off `event.like_count`, a
 * column `timeline_events` has never had. So a like was written to the
 * database and then read back as zero, on every surface, forever. Confirmed in
 * production 2026-08-28: `timeline_likes` held the row and
 * `timeline_event_stats.like_count` read 1, while the post page rendered an
 * empty, unpressed heart.
 *
 * Counts come from `timeline_event_stats`, which the reaction RPCs maintain
 * and which is the single place they live. "Did I react" cannot come from
 * there — it is per-reader — so it is read from the membership tables.
 *
 * Batched on purpose: three queries for a whole page regardless of how many
 * posts are on it, matching enrichment.ts next door. The naive version is a
 * lookup per post per reaction, which is 60 round-trips for a 20-post feed.
 */

import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import { db, getCurrentUserId } from './social-shared';

export interface ReactionState {
  likesCount: number;
  dislikesCount: number;
  commentsCount: number;
  sharesCount: number;
  userLiked: boolean;
  userDisliked: boolean;
}

export const EMPTY_REACTION_STATE: ReactionState = {
  likesCount: 0,
  dislikesCount: 0,
  commentsCount: 0,
  sharesCount: 0,
  userLiked: false,
  userDisliked: false,
};

/**
 * Attach reaction state to already-mapped display events, in place.
 *
 * For the read paths that do not go through `enrichEventsForDisplay` —
 * `transformEnrichedEventToDisplay` is synchronous and cannot fetch, so the
 * feeds built on it (followed users, search, threads) have to ask afterwards.
 * They ask through here rather than each doing its own lookup, which is the
 * mistake that produced three separate paths all reporting zero.
 */
export async function attachReactionState<T extends { id: string }>(posts: T[]): Promise<T[]> {
  if (posts.length === 0) {
    return posts;
  }
  try {
    const userId = await getCurrentUserId();
    const byEvent = await fetchReactionState(
      posts.map(p => p.id),
      userId
    );
    for (const post of posts) {
      Object.assign(post, byEvent.get(post.id) ?? EMPTY_REACTION_STATE);
    }
  } catch (error) {
    // Counters are worth less than the feed they sit in.
    logger.error('Could not attach reaction state', error, 'Timeline');
  }
  return posts;
}

/** Which of these events the reader has reacted to, and the public totals. */
export async function fetchReactionState(
  eventIds: string[],
  userId?: string | null
): Promise<Map<string, ReactionState>> {
  const byEvent = new Map<string, ReactionState>();
  if (eventIds.length === 0) {
    return byEvent;
  }

  const ids = Array.from(new Set(eventIds));
  for (const id of ids) {
    byEvent.set(id, { ...EMPTY_REACTION_STATE });
  }

  // A reader who is not signed in still sees the totals; only the "did I"
  // half needs an identity, so those queries are skipped rather than the
  // whole enrichment.
  const [stats, likes, dislikes] = await Promise.all([
    db
      .from(DATABASE_TABLES.TIMELINE_EVENT_STATS)
      .select('event_id, like_count, dislike_count, comment_count, share_count')
      .in('event_id', ids),
    userId
      ? db.from(DATABASE_TABLES.TIMELINE_LIKES).select('event_id').in('event_id', ids).eq('user_id', userId)
      : Promise.resolve({ data: [], error: null }),
    userId
      ? db
          .from(DATABASE_TABLES.TIMELINE_DISLIKES)
          .select('event_id')
          .in('event_id', ids)
          .eq('user_id', userId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (stats.error) {
    // Degrade to zeros rather than failing the feed: a post with no counter is
    // worse than a post, but a blank timeline is worse than both.
    logger.error('Could not read timeline reaction counts', stats.error, 'Timeline');
  }

  for (const row of (stats.data ?? []) as Array<Record<string, number | string>>) {
    const id = row.event_id as string;
    const current = byEvent.get(id);
    if (!current) {
      continue;
    }
    current.likesCount = Number(row.like_count) || 0;
    current.dislikesCount = Number(row.dislike_count) || 0;
    current.commentsCount = Number(row.comment_count) || 0;
    current.sharesCount = Number(row.share_count) || 0;
  }

  for (const row of (likes.data ?? []) as Array<{ event_id: string }>) {
    const current = byEvent.get(row.event_id);
    if (current) {
      current.userLiked = true;
    }
  }

  for (const row of (dislikes.data ?? []) as Array<{ event_id: string }>) {
    const current = byEvent.get(row.event_id);
    if (current) {
      current.userDisliked = true;
    }
  }

  return byEvent;
}
