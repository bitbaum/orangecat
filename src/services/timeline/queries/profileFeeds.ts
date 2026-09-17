/**
 * Profile Feed Queries
 *
 * Handles profile-related timeline feed queries.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Extracted from feeds.ts
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { TIMELINE_TABLES } from '@/config/database-tables';
import type { TimelineFeedResponse, TimelineFilters, TimelinePagination } from '@/types/timeline';
import { pageWindow, feedResponse, emptyFeed } from './feed-shape';
import { transformEnrichedEventToDisplay } from './helpers';

/**
 * Get profile timeline feed
 */
export async function getProfileFeed(
  profileId: string,
  filters?: Partial<TimelineFilters>,
  pagination?: Partial<TimelinePagination>
): Promise<TimelineFeedResponse> {
  try {
    const { page, limit, offset } = pageWindow(pagination);

    const {
      data: events,
      error,
      count,
    } = await supabase
      .from(TIMELINE_TABLES.ENRICHED_VIEW)
      .select('*', { count: 'exact' })
      .or(`actor_id.eq.${profileId},and(subject_type.eq.profile,subject_id.eq.${profileId})`)
      .order('event_timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to fetch profile timeline feed', error, 'Timeline');
      throw error;
    }

    // Transform enriched VIEW data to display events
    const displayEvents = (events || []).map(transformEnrichedEventToDisplay);

    return feedResponse(displayEvents, { page, limit }, count || 0, filters);
  } catch (error) {
    logger.error('Error fetching profile timeline feed', error, 'Timeline');
    // Return empty feed instead of throwing
    return emptyFeed(filters);
  }
}
