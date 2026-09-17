/**
 * Event Queries
 *
 * Handles individual event queries:
 * - Get event by ID
 * - Get replies to an event
 * - Search posts
 * - Get thread posts
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Extracted from feeds.ts
 */

import { callRpc } from '@/lib/supabase/untyped';
import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { TIMELINE_TABLES } from '@/config/database-tables';
import type { TimelineDisplayEvent, TimelineEventType, TimelineActorType } from '@/types/timeline';
import { transformEnrichedEventToDisplay } from './helpers';
import {
  attachReactionState,
  EMPTY_REACTION_STATE,
} from '@/services/timeline/processors/reaction-state';
import { enrichEventsForDisplay } from '@/services/timeline/processors/enrichment';
import { getTimeAgo, isEventRecent } from '@/services/timeline/formatters';

/**
 * Get event by ID
 */
export async function getEventById(
  eventId: string
): Promise<{ success: boolean; event?: TimelineDisplayEvent; error?: string }> {
  try {
    // Try enriched view first
    const { data: event, error } = await supabase
      .from(TIMELINE_TABLES.ENRICHED_VIEW)
      .select('*')
      .eq('id', eventId)
      .eq('is_deleted', false)
      .single();

    if (error) {
      // Fallback to raw table
      const { data: rawEvent, error: rawError } = await supabase
        .from(TIMELINE_TABLES.EVENTS)
        .select('*')
        .eq('id', eventId)
        .eq('is_deleted', false)
        .single();

      if (rawError || !rawEvent) {
        return { success: false, error: 'Event not found' };
      }

      const enriched = await enrichEventsForDisplay([rawEvent]);
      return { success: true, event: enriched[0] };
    }

    const enriched = await enrichEventsForDisplay([event]);
    return { success: true, event: enriched[0] };
  } catch (error) {
    logger.error('Error fetching event by ID', error, 'Timeline');
    return { success: false, error: 'Failed to fetch event' };
  }
}

/**
 * Get replies to a specific event (thread-friendly, uses parent_event_id)
 * Builds a small reply tree to enable nested replies in the UI.
 */
export async function getReplies(
  eventId: string,
  limit: number = 50
): Promise<{ success: boolean; replies?: TimelineDisplayEvent[]; error?: string }> {
  try {
    // Fetch the tree a LEVEL at a time, then enrich the whole thing once.
    //
    // This used to recurse per node: one query and one enrichEventsForDisplay
    // per reply. Enrichment is itself several round-trips — profiles, projects,
    // the reader's id, and the three reaction tables — so a thread cost roughly
    // six requests per reply, and opening a three-reply thread fired eight
    // `/auth/v1/user` calls alone. Level-order asks once per depth regardless of
    // width, and enriches once regardless of both.
    const MAX_DEPTH = 3;
    const levels: Array<Record<string, unknown>>[] = [];
    let frontier = [eventId];

    for (let depth = 0; depth <= MAX_DEPTH && frontier.length > 0; depth++) {
      const { data: childEvents, error } = await supabase
        .from(TIMELINE_TABLES.EVENTS)
        .select('*')
        .in('parent_event_id', frontier)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(depth === 0 ? limit : 200);

      if (error) {
        logger.error('Error fetching replies', error, 'Timeline');
        break;
      }

      const rows = (childEvents || []) as Array<Record<string, unknown>>;
      if (rows.length === 0) {
        break;
      }
      levels.push(rows);
      frontier = rows.map(row => String(row.id));
    }

    const enriched = await enrichEventsForDisplay(levels.flat());

    // Assemble parent → children from the flat list. Every node is visited
    // once, and a reply whose parent did not come back (deleted mid-read)
    // simply does not attach, rather than orphaning the whole branch.
    const byParent = new Map<string, TimelineDisplayEvent[]>();
    for (const reply of enriched) {
      const parentId = reply.parentEventId ?? '';
      byParent.set(parentId, [...(byParent.get(parentId) ?? []), reply]);
    }

    const attach = (parentId: string, depth: number): TimelineDisplayEvent[] => {
      if (depth > MAX_DEPTH) {
        return [];
      }
      return (byParent.get(parentId) ?? []).map(reply => {
        const nested = attach(reply.id, depth + 1);
        return { ...reply, replies: nested, replyCount: nested.length };
      });
    };

    const replies = attach(eventId, 0);
    return { success: true, replies };
  } catch (error) {
    logger.error('Error fetching replies', error, 'Timeline');
    return { success: false, error: 'Failed to fetch replies' };
  }
}

/**
 * Search posts by query string
 * Searches in title, description, and actor names
 */
export async function searchPosts(
  query: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<{
  success: boolean;
  posts?: TimelineDisplayEvent[];
  total?: number;
  error?: string;
}> {
  try {
    if (!query || query.trim().length < 2) {
      return { success: false, error: 'Search query must be at least 2 characters' };
    }

    const searchQuery = query.trim().toLowerCase();
    const limit = Math.min(options?.limit || 20, 50);
    const offset = options?.offset || 0;

    // Search in enriched_timeline_events view
    // Using ilike for case-insensitive search
    const escapedSearch = searchQuery.replace(/[%_]/g, '\\$&');
    const {
      data: events,
      error,
      count,
    } = await supabase
      .from(TIMELINE_TABLES.ENRICHED_VIEW)
      .select('*', { count: 'exact' })
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .or(`title.ilike.%${escapedSearch}%,description.ilike.%${escapedSearch}%`)
      .order('event_timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Search query failed', error, 'Timeline');
      return { success: false, error: 'Search failed. Please try again.' };
    }

    // Transform to display events. The view carries no reaction columns, so
    // search results would otherwise show every post as unreacted-to.
    const displayEvents = await attachReactionState(
      (events || []).map(transformEnrichedEventToDisplay)
    );

    return {
      success: true,
      posts: displayEvents,
      total: count || 0,
    };
  } catch (error) {
    logger.error('Error searching posts', error, 'Timeline');
    return { success: false, error: 'Search failed. Please try again.' };
  }
}

/**
 * Get all posts in a thread
 */
export async function getThreadPosts(threadId: string): Promise<{
  success: boolean;
  posts?: TimelineDisplayEvent[];
  total?: number;
  error?: string;
}> {
  try {
    const result = await callRpc(supabase, 'get_thread_posts', {
      p_thread_id: threadId,
      p_limit: 50,
      p_offset: 0,
    });

    if (result.error) {
      logger.error('Failed to get thread posts', result.error, 'Timeline');
      return { success: false, error: result.error.message };
    }

    if (!result.data || result.data.length === 0) {
      return { success: true, posts: [], total: 0 };
    }

    // Type for RPC result row
    interface ThreadPostRow {
      id: string;
      event_type: string;
      actor_id: string;
      actor_name?: string;
      actor_username?: string;
      actor_avatar?: string;
      event_timestamp: string;
      parent_event_id?: string;
      thread_id?: string;
      thread_depth?: number;
      is_quote_reply?: boolean;
      metadata?: Record<string, unknown>;
      [key: string]: unknown;
    }

    // Convert to display events - cast to satisfy TimelineDisplayEvent requirements
    // RPC returns partial data that gets enriched later in the UI
    const displayEvents = (result.data as ThreadPostRow[]).map((event: ThreadPostRow) => ({
      ...event,
      eventType: event.event_type as TimelineEventType,
      actor: {
        id: event.actor_id,
        name: event.actor_name || 'Unknown',
        username: event.actor_username,
        avatar: event.actor_avatar,
        type: 'user' as TimelineActorType,
      },
      timeAgo: getTimeAgo(event.event_timestamp),
      isRecent: isEventRecent(event.event_timestamp),
      // Filled in below from timeline_event_stats. These were hardcoded zeros
      // under a comment saying the UI enriched them later; nothing did, so
      // every thread post rendered as if nobody had ever reacted to it.
      ...EMPTY_REACTION_STATE,
      userShared: false,
      userCommented: false,
      parentPostId: event.parent_event_id,
      threadId: event.thread_id,
      threadDepth: event.thread_depth,
      isQuoteReply: event.is_quote_reply || false,
      quotedContent: (event.metadata as { quoted_content?: string })?.quoted_content,
    })) as unknown as TimelineDisplayEvent[];

    // Built from an RPC rather than through enrichEventsForDisplay, so this
    // path asks for reaction state itself — through the same helper, so the
    // two cannot disagree about where a count comes from.
    await attachReactionState(displayEvents);

    return {
      success: true,
      posts: displayEvents,
      total: result.data.length,
    };
  } catch (error) {
    logger.error('Error getting thread posts', error, 'Timeline');
    return { success: false, error: 'Failed to load thread. Please try again.' };
  }
}
