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
import { getCurrentUserId, displayEventsFromView } from './helpers';
import { PROJECT_WALL_CONTEXT_LIMIT, projectWallFilter } from './project-wall-filter';

/**
 * Events placed on this project's wall through a `project` visibility context —
 * the newest ones, bounded (see PROJECT_WALL_CONTEXT_LIMIT). A failed read
 * leaves the wall showing what was written on it directly.
 */
async function getProjectWallEventIds(projectId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from(TIMELINE_TABLES.EVENT_VISIBILITY)
    .select('event_id')
    .eq('timeline_type', 'project')
    .eq('timeline_owner_id', projectId)
    .order('created_at', { ascending: false })
    .limit(PROJECT_WALL_CONTEXT_LIMIT);
  if (error) {
    logger.warn('Failed to read project wall contexts', { projectId, error }, 'Timeline');
    return [];
  }
  return [...new Set((data ?? []).map(row => row.event_id as string))];
}

/**
 * Get project timeline feed: what was written on the wall and what its authors
 * also posted there (see project-wall-filter.ts).
 */
export async function getProjectFeed(
  projectId: string,
  filters?: Partial<TimelineFilters>,
  pagination?: Partial<TimelinePagination>
): Promise<TimelineFeedResponse> {
  try {
    const { page, limit, offset } = pageWindow(pagination);

    const currentUserId = await getCurrentUserId();
    const wallEventIds = await getProjectWallEventIds(projectId);
    const {
      data: events,
      error,
      count,
    } = await supabase
      .from(TIMELINE_TABLES.ENRICHED_VIEW)
      .select('*', { count: 'exact' })
      .or(projectWallFilter(projectId, wallEventIds, currentUserId))
      .order('event_timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to fetch project timeline feed', error, 'Timeline');
      throw error;
    }

    // Transform enriched VIEW data to display events
    const displayEvents = await displayEventsFromView(events);

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
