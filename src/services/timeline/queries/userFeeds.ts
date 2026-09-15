/**
 * User Feed Queries
 *
 * Handles user-related timeline feed queries:
 * - User's personal timeline feed
 * - Followed users feed
 * - Enriched user feed
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Extracted from feeds.ts
 */

import { callRpc } from '@/lib/supabase/untyped';
import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES, TIMELINE_TABLES } from '@/config/database-tables';
import type {
  TimelineFeedResponse,
  TimelineDisplayEvent,
  TimelineFilters,
  TimelinePagination,
} from '@/types/timeline';
import { pageWindow, feedResponse, emptyFeed } from './feed-shape';
import { getCurrentUserId, transformEnrichedEventToDisplay } from './helpers';
import { getDateRangeFilter } from '@/services/timeline/formatters/filters';
import { enrichEventsForDisplay } from '@/services/timeline/processors/enrichment';
import { attachReactionState } from '@/services/timeline/processors/reaction-state';

/**
 * Get user's personalized timeline feed
 */
export async function getUserFeed(
  userId: string,
  filters?: Partial<TimelineFilters>,
  pagination?: Partial<TimelinePagination>
): Promise<TimelineFeedResponse> {
  try {
    const { page, limit, offset } = pageWindow(pagination);

    // Build filter conditions

    let query = callRpc(supabase, 'get_user_timeline_feed', {
      p_user_id: userId,
      p_limit: limit,
      p_offset: offset,
    });

    // Apply additional filters
    if (filters?.eventTypes?.length) {
      query = query.in('event_type', filters.eventTypes);
    }

    if (filters?.dateRange && filters.dateRange !== 'all') {
      const dateFilter = getDateRangeFilter(filters.dateRange);
      query = query.gte('event_timestamp', dateFilter.start).lte('event_timestamp', dateFilter.end);
    }

    if (filters?.visibility?.length) {
      query = query.in('visibility', filters.visibility);
    }

    // How many posts exist in total (for pagination) is a separate question
    // from what the first page contains, and neither answer needs the other.
    // Asking now rather than after enrichment overlaps the two round-trips.
    // The RPC resolves user→actor internally.
    const countQuery = callRpc(
      supabase,
      'get_user_timeline_feed',
      {
        p_user_id: userId,
        p_limit: 0,
        p_offset: 0,
      },
      { count: 'exact', head: true }
    );

    const { data: events, error } = await query;

    if (error) {
      // The count is already in flight; let it settle so it cannot reject
      // unhandled after we leave.
      void countQuery.then(
        () => undefined,
        () => undefined
      );
      logger.error('Failed to fetch timeline feed', error, 'Timeline');
      throw error;
    }

    // Transform to display events
    const displayEvents = await enrichEventsForDisplay(events || []);

    const { count } = await countQuery;

    const totalEvents = count || displayEvents.length;

    return feedResponse(displayEvents, { page, limit }, totalEvents, filters);
  } catch (error) {
    logger.error('Error fetching user timeline feed', error, 'Timeline');
    // Return empty feed instead of throwing - error is logged for debugging
    return emptyFeed(filters, pagination);
  }
}

/**
 * Get feed of events from users the current user follows
 */
export async function getFollowedUsersFeed(
  filters?: Partial<TimelineFilters>,
  pagination?: Partial<TimelinePagination>
): Promise<TimelineFeedResponse> {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return emptyFeed(filters);
    }

    const { page, limit, offset } = pageWindow(pagination);

    // Get list of followed user IDs. The follows table's canonical columns are
    // follower_id / following_id — there is no followed_user_id or is_active
    // column (selecting them 400s and silently empties this feed).
    const { data: follows, error: followsError } = await supabase
      .from(DATABASE_TABLES.FOLLOWS)
      .select('following_id')
      .eq('follower_id', currentUserId);

    if (followsError) {
      logger.error('Failed to fetch followed users', followsError, 'Timeline');
      throw followsError;
    }

    const followedUserIds =
      (follows as { following_id: string }[] | null)?.map(f => f.following_id) || [];

    if (followedUserIds.length === 0) {
      return emptyFeed(filters);
    }

    // Build query for events from followed users
    let query = supabase
      .from(TIMELINE_TABLES.ENRICHED_VIEW)
      .select('*', { count: 'exact' })
      .in('actor_id', followedUserIds)
      .eq('is_deleted', false)
      .order('event_timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (filters?.eventTypes?.length) {
      query = query.in('event_type', filters.eventTypes);
    }

    if (filters?.dateRange && filters.dateRange !== 'all') {
      const dateFilter = getDateRangeFilter(filters.dateRange);
      query = query.gte('event_timestamp', dateFilter.start).lte('event_timestamp', dateFilter.end);
    }

    if (filters?.visibility?.length) {
      query = query.in('visibility', filters.visibility);
    } else {
      // Default to public events for followed users feed
      query = query.eq('visibility', 'public');
    }

    const { data: events, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch followed users feed', error, 'Timeline');
      throw error;
    }

    // Transform enriched VIEW data to display events. The view carries no
    // reaction columns, so without this every post in the followed feed
    // renders as though nobody had ever liked it.
    const displayEvents = await attachReactionState(
      (events || []).map(transformEnrichedEventToDisplay)
    );

    return feedResponse(displayEvents, { page, limit }, count || 0, filters);
  } catch (error) {
    logger.error('Error fetching followed users feed', error, 'Timeline');
    // Return empty feed instead of throwing - error is logged for debugging
    return emptyFeed(filters, pagination);
  }
}

/**
 * Get enriched timeline feed with social interactions
 */
export async function getEnrichedUserFeed(
  userId: string,
  filters?: Partial<TimelineFilters>,
  pagination?: Partial<TimelinePagination>,
  getDemoTimelineEvents?: (userId: string) => Record<string, unknown>[],
  // Which feed RPC to call. Default = the journey feed (own + followed + public).
  // Pass 'get_following_feed' for the true home feed (own + followed only).
  rpcName: 'get_user_timeline_feed' | 'get_following_feed' = 'get_user_timeline_feed'
): Promise<TimelineFeedResponse> {
  try {
    const { page, limit, offset } = pageWindow(pagination);

    let events: Record<string, unknown>[] = [];
    let totalEvents = 0;

    try {
      // The DB only has get_user_timeline_feed today — the "enriched" variant
      // was never created, so calling it just generated a 404 on every
      // dashboard load and then fell through to this same basic-feed code
      // path. Skip the broken probe and call the basic feed directly; the
      // enrichment fields below default to zero, matching what the previous
      // fallback emitted. If get_enriched_timeline_feed is added later,
      // restore the original ladder.

      const { data: basicEvents, error: basicError } = await callRpc(supabase, rpcName, {
        p_user_id: userId,
        p_limit: limit,
        p_offset: offset,
      });

      if (basicError) {
        logger.warn('Basic timeline feed not available, using empty feed', basicError, 'Timeline');
        events = [];
        totalEvents = 0;
      } else {
        events = ((basicEvents || []) as Record<string, unknown>[]).map(event => ({
          ...event,
          like_count: 0,
          share_count: 0,
          comment_count: 0,
          user_liked: false,
          user_shared: false,
          user_commented: false,
        }));
        totalEvents = events.length;
      }
    } catch (dbError) {
      logger.warn('Database functions not available, returning demo timeline', dbError, 'Timeline');
      // Return demo data so the UI works even without database
      if (getDemoTimelineEvents) {
        events = getDemoTimelineEvents(userId);
        totalEvents = events.length;
      } else {
        events = [];
        totalEvents = 0;
      }
    }

    // Transform to display events with social data. Enrichment is batched
    // (3 queries total) instead of up to 3 lookups per event — see
    // processors/enrichment.ts. Batch output preserves input order, so the
    // social counters can be zipped back in by index.
    // Reaction counts arrive with the events from enrichEventsForDisplay. This
    // used to overwrite them here with `event.like_count` / `event.user_liked`
    // — columns `timeline_events` has never had — so every enriched counter was
    // replaced by `undefined || 0` on its way to the screen.
    const displayEvents = (await enrichEventsForDisplay(
      events || []
    )) as TimelineDisplayEvent[];

    return feedResponse(displayEvents, { page, limit }, totalEvents, filters);
  } catch (error) {
    logger.error('Error fetching enriched user timeline feed', error, 'Timeline');
    // Return empty feed instead of throwing - error is logged for debugging
    return emptyFeed(filters, pagination);
  }
}

/**
 * Home feed — posts from people/projects the user FOLLOWS (plus their own),
 * excluding the public-everyone firehose. The true "Twitter home" feed, distinct
 * from the journey feed (getEnrichedUserFeed) and /community (getCommunityFeed).
 */
export async function getEnrichedFollowingFeed(
  userId: string,
  filters?: Partial<TimelineFilters>,
  pagination?: Partial<TimelinePagination>
): Promise<TimelineFeedResponse> {
  return getEnrichedUserFeed(userId, filters, pagination, undefined, 'get_following_feed');
}
