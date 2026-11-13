/**
 * Community Feed Queries
 *
 * Handles community-related timeline feed queries:
 * - Public community timeline feed
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Extracted from feeds.ts
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { withApiRetry } from '@/utils/retry';
import { TIMELINE_TABLES } from '@/config/database-tables';
import { EXCLUDE_AUTOMATED_PUBLISH_OR_FILTER } from '@/config/external-publish';
import type { TimelineFeedResponse, TimelineFilters, TimelinePagination } from '@/types/timeline';
import { pageWindow, feedResponse, emptyFeed } from './feed-shape';
import { displayEventsFromView } from './helpers';
import { NOT_A_FIXTURE_AUTHOR } from '@/domain/people/publicPeopleFilter';

/**
 * Get public community timeline (posts from all users and projects)
 * Uses community_timeline_no_duplicates VIEW to eliminate duplicate cross-posts,
 * and leaves out automated publishes (Loki's build updates).
 */
export async function getCommunityFeed(
  filters?: Partial<TimelineFilters>,
  pagination?: Partial<TimelinePagination>
): Promise<TimelineFeedResponse> {
  try {
    return await withApiRetry(
      async () => {
        const { page, limit, offset } = pageWindow(pagination);

        // Query community timeline view (NO DUPLICATES!)
        const {
          data: enrichedEvents,
          error,
          count,
        } = await supabase
          .from(TIMELINE_TABLES.COMMUNITY_VIEW)
          .select('*', { count: 'exact' })
          // Automated build updates stay on the project's own wall; the public
          // feed is for what people post (config/external-publish.ts).
          .or(EXCLUDE_AUTOMATED_PUBLISH_OR_FILTER)
          // A QA run's account posts nothing a visitor came for.
          .or(NOT_A_FIXTURE_AUTHOR)
          .order('event_timestamp', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          logger.error('Failed to fetch community feed from enriched VIEW', error, 'Timeline');
          throw error;
        }

        // Transform enriched VIEW data to display events (no N+1 queries needed!)
        const displayEvents = await displayEventsFromView(enrichedEvents);

        return feedResponse(displayEvents, { page, limit }, count || 0, filters);
      },
      { maxAttempts: 2, baseDelay: 500 }
    ); // Quick retry for feed loading
  } catch (error) {
    logger.error('Error fetching community timeline feed', error, 'Timeline');
    // Return empty feed instead of throwing
    return emptyFeed(filters);
  }
}
