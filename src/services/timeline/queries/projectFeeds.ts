/**
 * Project Feed Queries
 *
 * Handles project-related timeline feed queries:
 * - Project timeline feed
 * - Project timeline (simplified)
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Extracted from feeds.ts
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { TIMELINE_TABLES } from '@/config/database-tables';
import type {
  TimelineFeedResponse,
  TimelineDisplayEvent,
  TimelineFilters,
  TimelinePagination,
} from '@/types/timeline';
import { pageWindow, feedResponse, emptyFeed } from './feed-shape';
import { getCurrentUserId, transformEnrichedEventToDisplay } from './helpers';

/**
 * Get project timeline feed
 */
export async function getProjectFeed(
  projectId: string,
  filters?: Partial<TimelineFilters>,
  pagination?: Partial<TimelinePagination>
): Promise<TimelineFeedResponse> {
  try {
    const { page, limit, offset } = pageWindow(pagination);

    const currentUserId = await getCurrentUserId();
    // When the visitor is unauthenticated, getCurrentUserId returns null.
    // Interpolating that into `actor_id.eq.${currentUserId}` produces the
    // literal string `actor_id.eq.null`, which PostgREST tries to parse as
    // a UUID and 400s with "invalid input syntax for type uuid: null" —
    // surfaced as a console error on every public visitor's project page.
    // Only include the actor branch when we have a real UUID.
    const orClause = currentUserId
      ? `visibility.eq.public,actor_id.eq.${currentUserId}`
      : `visibility.eq.public`;
    const {
      data: events,
      error,
      count,
    } = await supabase
      .from(TIMELINE_TABLES.ENRICHED_VIEW)
      .select('*', { count: 'exact' })
      .eq('subject_type', 'project')
      .eq('subject_id', projectId)
      .or(orClause)
      .order('event_timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to fetch project timeline feed', error, 'Timeline');
      throw error;
    }

    // Transform enriched VIEW data to display events
    const displayEvents = (events || []).map(transformEnrichedEventToDisplay);

    return feedResponse(displayEvents, { page, limit }, count || 0, filters);
  } catch (error) {
    logger.error('Error fetching project timeline feed', error, 'Timeline');
    // Return empty feed instead of throwing
    return emptyFeed(filters);
  }
}

/**
 * Get project timeline (simplified version)
 */
export async function getProjectTimeline(
  projectId: string,
  limit: number = 50
): Promise<TimelineDisplayEvent[]> {
  try {
    const feed = await getProjectFeed(projectId, {}, { limit });
    return feed.events;
  } catch (error) {
    logger.error('Error fetching project timeline', error, 'Timeline');
    return [];
  }
}
