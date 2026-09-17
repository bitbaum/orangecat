/**
 * Client-side reader for /api/social/following/[id] and /api/social/followers/[id].
 *
 * SSOT for that endpoint pair's response envelope, which nests the rows TWO
 * levels deep: `{ success, data: { data: [...], pagination } }`.
 *
 * Three call sites used to unwrap that by hand and one of them read
 * `data.data` — the object — as if it were the array. The guard was
 * `Array.isArray(data.data)`, so it failed silently: the profile page's
 * Follow button never learned you already followed someone, always read
 * "Follow", and clicking it returned 409 "Already following this user".
 * Every consumer now goes through this function, so there is exactly one
 * unwrap to get right. `scripts/check-follow-envelope.mjs` keeps it that way.
 */

import { API_ROUTES } from '@/config/api-routes';
import { logger } from '@/utils/logger';

/** The profile joined onto a follow row (aliased `profile`, singular, by the route). */
export interface FollowListProfile {
  id: string;
  username: string;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  bitcoin_address?: string | null;
  lightning_address?: string | null;
}

/**
 * One row of a follow list. The direction decides which id column is present:
 * `following` rows carry `following_id`, `followers` rows carry `follower_id`.
 */
export interface FollowListRow {
  following_id?: string;
  follower_id?: string;
  created_at: string;
  profile?: FollowListProfile | null;
}

export type FollowDirection = 'following' | 'followers';

/**
 * Unwrap the follow-list envelope. Exported for the contract test, which feeds
 * it the real route's real output — that keeps the parse and the route in step.
 */
export function parseFollowListResponse(payload: unknown): FollowListRow[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const body = payload as { success?: boolean; data?: unknown };
  if (!body.success) {
    return [];
  }
  const inner = body.data;
  if (Array.isArray(inner)) {
    return inner as FollowListRow[];
  }
  if (inner && typeof inner === 'object') {
    const nested = (inner as { data?: unknown }).data;
    if (Array.isArray(nested)) {
      return nested as FollowListRow[];
    }
  }
  return [];
}

/**
 * Fetch one side of a user's follow graph.
 *
 * Returns `[]` on any transport or shape failure — callers render an empty
 * list rather than crashing, and the reason is logged.
 */
export async function fetchFollowList(
  direction: FollowDirection,
  userId: string
): Promise<FollowListRow[]> {
  const url =
    direction === 'following'
      ? API_ROUTES.SOCIAL.FOLLOWING(userId)
      : API_ROUTES.SOCIAL.FOLLOWERS(userId);
  try {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
      logger.error('Follow list request failed', { direction, userId, status: response.status });
      return [];
    }
    return parseFollowListResponse(await response.json());
  } catch (error) {
    logger.error('Failed to fetch follow list', { direction, userId, error });
    return [];
  }
}

/**
 * Does the signed-in user follow `targetId`?
 *
 * One indexed lookup, NOT a search of the following list: that list is capped
 * at DEFAULT_PAGE_SIZE, so searching it answers correctly only for the first
 * 20 people you follow and then silently reports "not following" for the rest
 * — which is the same 409 the Follow button was just fixed for.
 *
 * Returns false when the answer cannot be obtained, which shows "Follow". That
 * is the recoverable direction: the button still works, and a 409 from the
 * POST reconciles the state (see useProfileActions).
 */
export async function fetchFollowStatus(targetId: string): Promise<boolean> {
  try {
    const response = await fetch(API_ROUTES.SOCIAL.FOLLOW_STATUS(targetId), {
      credentials: 'same-origin',
    });
    if (!response.ok) {
      // 401 is normal for a signed-out visitor, and not worth logging.
      if (response.status !== 401) {
        logger.error('Follow status request failed', { targetId, status: response.status });
      }
      return false;
    }
    const body = (await response.json()) as { success?: boolean; data?: { following?: unknown } };
    return body.success === true && body.data?.following === true;
  } catch (error) {
    logger.error('Failed to fetch follow status', { targetId, error });
    return false;
  }
}
