/**
 * Timeline reactions (likes / dislikes).
 *
 * Liking and disliking are mutually exclusive: the RPCs delete the opposing row
 * when you switch. That makes a single reaction a change to BOTH totals, which
 * is why everything here carries both counts rather than the one it asked for.
 */

import { logger } from '@/utils/logger';
import { withApiRetry } from '@/utils/retry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { db, getCurrentUserId } from './social-shared';

interface ReactionConfig {
  table: string;
  addRpc: string;
  removeRpc: string;
  /** Key in the RPC response containing this reaction's count, e.g. 'like_count' */
  countKey: string;
  /** The other reaction's count key, which the same response also carries. */
  oppositeCountKey: string;
}

interface ReactionResult {
  success: boolean;
  /** Whether this reaction is now set for this user. */
  active: boolean;
  /** This reaction's new total. */
  count: number;
  /** The OPPOSITE reaction's new total — it moves when you switch sides. */
  oppositeCount: number;
  error?: string;
}

/**
 * Read a count out of an RPC response.
 *
 * All four functions are `RETURNS TABLE(...)`, and PostgREST renders a
 * set-returning function as an ARRAY of rows — `[{ like_count: 1 }]`. This used
 * to index the array as if it were the row, so the lookup was always undefined
 * and the `|| 0` turned every successful reaction into a count of zero.
 *
 * The effect survived the whole time the RPCs were also raising 42703: liking
 * something persisted correctly and then rendered as if nobody had, because the
 * button state comes from `active` (a literal) while the number comes from
 * here. Accepts either shape, so a future rewrite to a scalar cannot silently
 * zero it.
 */
function readCount(data: unknown, countKey: string): number {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return 0;
  }
  const value = (row as Record<string, unknown>)[countKey];
  return typeof value === 'number' ? value : 0;
}

/**
 * Count a reaction table directly.
 *
 * Only used by the fallback paths below, where the RPC was unavailable and
 * there is no response to read counts out of. Counting the opposite table
 * costs one more query on a path that already failed once — cheaper than
 * returning a number the caller will render as truth.
 */
async function countFor(table: string, eventId: string): Promise<number> {
  const { count } = await db
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId);
  return count || 0;
}

function oppositeTable(table: string): string {
  return table === DATABASE_TABLES.TIMELINE_LIKES
    ? DATABASE_TABLES.TIMELINE_DISLIKES
    : DATABASE_TABLES.TIMELINE_LIKES;
}

async function toggleReaction(
  eventId: string,
  targetUserId: string,
  cfg: ReactionConfig
): Promise<ReactionResult> {
  const { table, addRpc, removeRpc, countKey, oppositeCountKey } = cfg;
  const failed = (error: string): ReactionResult => ({
    success: false,
    active: false,
    count: 0,
    oppositeCount: 0,
    error,
  });

  const { data: existing } = await db
    .from(table)
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', targetUserId)
    .single();

  if (existing) {
    // Remove reaction
    try {
      const { data, error } = await db.rpc(removeRpc, {
        p_event_id: eventId,
        p_user_id: targetUserId,
      });
      if (error) {
        logger.error(`Failed to call ${removeRpc}`, error, 'Timeline');
        return failed(error.message);
      }
      return {
        success: true,
        active: false,
        count: readCount(data, countKey),
        oppositeCount: readCount(data, oppositeCountKey),
      };
    } catch (dbError) {
      logger.warn(`RPC ${removeRpc} not available, using fallback`, dbError, 'Timeline');
      const { error: delErr } = await db
        .from(table)
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', targetUserId);
      if (delErr) {
        logger.error(`Fallback ${removeRpc} failed`, delErr, 'Timeline');
        return failed(delErr.message);
      }
      // Same blind spot as the add path below: RLS lets this client delete the
      // membership row but not correct timeline_event_stats, so the public
      // count stays high until an RPC toggle recomputes it.
      logger.error(
        'Reaction removed without updating timeline_event_stats — the public count stays stale until an RPC toggle recomputes it',
        { eventId, table, removeRpc },
        'Timeline'
      );
      return {
        success: true,
        active: false,
        count: await countFor(table, eventId),
        oppositeCount: await countFor(oppositeTable(table), eventId),
      };
    }
  } else {
    // Add reaction
    try {
      const { data, error } = await db.rpc(addRpc, {
        p_event_id: eventId,
        p_user_id: targetUserId,
      });
      if (error) {
        logger.error(`Failed to call ${addRpc}`, error, 'Timeline');
        return failed(error.message);
      }
      return {
        success: true,
        active: true,
        count: readCount(data, countKey),
        oppositeCount: readCount(data, oppositeCountKey),
      };
    } catch (dbError) {
      logger.warn(`RPC ${addRpc} not available, using fallback`, dbError, 'Timeline');
      const { error: insertErr } = await db
        .from(table)
        .insert({ event_id: eventId, user_id: targetUserId });
      if (insertErr) {
        logger.error(`Fallback ${addRpc} failed`, insertErr, 'Timeline');
        return failed(insertErr.message);
      }
      // The fallback INSERT does not retract the opposite reaction the way the
      // RPC does, so the opposite count is read rather than assumed.
      //
      // It also cannot maintain timeline_event_stats, which is where every
      // OTHER reader gets its counts: that table's only policy is SELECT, so a
      // write from this (user-scoped) client is rejected by RLS. Only the
      // SECURITY DEFINER RPCs can touch it. So the number returned below is
      // real for this caller and invisible to everyone else — the row is
      // written and the post still renders 0 until someone toggles it again
      // through the RPC. That is how 9 of 10 likes in production ended up
      // uncounted. Log it, because a count nobody else can see is a bug that
      // otherwise reports itself as success.
      logger.error(
        'Reaction written without updating timeline_event_stats — the count will read 0 for other readers until an RPC toggle recomputes it',
        { eventId, table, addRpc },
        'Timeline'
      );
      return {
        success: true,
        active: true,
        count: await countFor(table, eventId),
        oppositeCount: await countFor(oppositeTable(table), eventId),
      };
    }
  }
}

export interface ToggleLikeResult {
  success: boolean;
  liked: boolean;
  likeCount: number;
  /** Set when the server retracted a dislike as a result of this like. */
  disliked?: boolean;
  dislikeCount?: number;
  error?: string;
}

export interface ToggleDislikeResult {
  success: boolean;
  disliked: boolean;
  dislikeCount: number;
  liked?: boolean;
  likeCount?: number;
  error?: string;
}

/**
 * Like or unlike an event.
 *
 * Reports what happened to the DISLIKE as well. Liking retracts a dislike
 * server-side, and a caller that has to infer that gets it wrong — which is
 * how a post came to render as liked and disliked at the same time.
 */
export async function toggleLike(eventId: string, userId?: string): Promise<ToggleLikeResult> {
  try {
    return await withApiRetry(
      async () => {
        const targetUserId = userId || (await getCurrentUserId());
        if (!targetUserId) {
          return { success: false, liked: false, likeCount: 0, error: 'Authentication required' };
        }
        const r = await toggleReaction(eventId, targetUserId, {
          table: DATABASE_TABLES.TIMELINE_LIKES,
          addRpc: 'like_timeline_event',
          removeRpc: 'unlike_timeline_event',
          countKey: 'like_count',
          oppositeCountKey: 'dislike_count',
        });
        return {
          success: r.success,
          liked: r.active,
          likeCount: r.count,
          // Only a like retracts a dislike; un-liking leaves it untouched.
          disliked: r.active ? false : undefined,
          dislikeCount: r.oppositeCount,
          error: r.error,
        };
      },
      { maxAttempts: 2 } // Only retry once for likes to avoid spam
    );
  } catch (error) {
    logger.error('Error toggling like on timeline event', error, 'Timeline');
    return { success: false, liked: false, likeCount: 0, error: 'Internal server error' };
  }
}

/** Toggle dislike on a timeline event (for scam detection and wisdom of crowds). */
export async function toggleDislike(
  eventId: string,
  userId?: string
): Promise<ToggleDislikeResult> {
  try {
    const targetUserId = userId || (await getCurrentUserId());
    if (!targetUserId) {
      return { success: false, disliked: false, dislikeCount: 0, error: 'Authentication required' };
    }
    const r = await toggleReaction(eventId, targetUserId, {
      table: DATABASE_TABLES.TIMELINE_DISLIKES,
      addRpc: 'dislike_timeline_event',
      removeRpc: 'undislike_timeline_event',
      countKey: 'dislike_count',
      oppositeCountKey: 'like_count',
    });
    return {
      success: r.success,
      disliked: r.active,
      dislikeCount: r.count,
      liked: r.active ? false : undefined,
      likeCount: r.oppositeCount,
      error: r.error,
    };
  } catch (error) {
    logger.error('Error toggling dislike on timeline event', error, 'Timeline');
    return { success: false, disliked: false, dislikeCount: 0, error: 'Internal server error' };
  }
}
