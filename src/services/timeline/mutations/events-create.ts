/**
 * Timeline event CREATE operations. Extracted verbatim from events.ts (SoC):
 * createEventWithVisibility, createEvent, createProjectEvent,
 * createTransactionEvent, createQuoteReply. Re-exported from events.ts so the
 * public surface (timeline/index.ts) is unchanged. No behavior change.
 */

import { callRpc } from '@/lib/supabase/untyped';
import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';
import type {
  TimelineEventResponse,
  CreateTimelineEventRequest,
  TimelineEventType,
  TimelineVisibility,
  TimelineEvent,
  TimelineDisplayEvent,
} from '@/types/timeline';
import { validateEventRequest } from '../processors/validation';
import {
  generateProjectEventTitle,
  generateProjectEventDescription,
  shouldFeatureProjectEvent,
} from '../formatters/eventTitles';
import {
  resolveActorId,
  buildSafeTitle,
  fetchCreatedEvent,
  handlePostCreationHooks,
} from './events-helpers';

/**
 * Create a new timeline event with visibility contexts (no duplicates)
 * This is the NEW preferred method for creating posts with cross-posting support
 */
export async function createEventWithVisibility(
  request: CreateTimelineEventRequest & {
    timelineContexts?: Array<{
      timeline_type: 'profile' | 'project' | 'community';
      timeline_owner_id: string | null;
    }>;
  }
): Promise<TimelineEventResponse> {
  try {
    const actorId = await resolveActorId(request.actorId);
    if (!actorId) {
      return { success: false, error: 'Authentication required' };
    }

    const validation = validateEventRequest(request);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const timelineContextsJson = (request.timelineContexts || []).map(ctx => ({
      timeline_type: ctx.timeline_type,
      timeline_owner_id: ctx.timeline_owner_id,
    }));

    const safeTitle = buildSafeTitle(request.title, request.description);

    // Use database function to create post with visibility contexts
    // The function returns JSONB, so we need to parse it

    const { data, error } = await callRpc(supabase, 'create_post_with_visibility', {
      p_event_type: request.eventType || 'post_created',
      p_actor_id: actorId,
      p_subject_type: request.subjectType || 'profile',
      p_subject_id: request.subjectId || null,
      p_title: safeTitle,
      p_description: request.description || null,
      p_visibility: request.visibility || 'public',
      p_metadata: request.metadata || {},
      p_timeline_contexts: timelineContextsJson as unknown as Record<string, unknown>, // Supabase JSONB type
    });

    if (error) {
      logger.error('Failed to create post with visibility', { error, data }, 'Timeline');

      // Provide more specific error messages
      if (error.message?.includes('function') && error.message?.includes('does not exist')) {
        return {
          success: false,
          error: 'Posting feature is not available. Please contact support if this persists.',
        };
      }

      if (error.message?.includes('permission') || error.message?.includes('policy')) {
        return {
          success: false,
          error: 'You do not have permission to post here. Please check your account status.',
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to create post. Please try again.',
      };
    }

    // Handle case where data might be null or undefined
    if (!data) {
      logger.error('Function returned no data', { error, request }, 'Timeline');
      return { success: false, error: 'No response from server. Please try again.' };
    }

    // Parse the JSONB response
    let result: {
      success?: boolean;
      error?: string;
      post_id?: string;
      data?: { post_id?: string };
      id?: string;
      visibility_count?: number;
    };
    if (typeof data === 'string') {
      try {
        result = JSON.parse(data);
      } catch (parseError) {
        logger.error('Failed to parse function response', { parseError, data }, 'Timeline');
        return { success: false, error: 'Invalid response from server. Please try again.' };
      }
    } else if (typeof data === 'object') {
      result = data as typeof result;
    } else {
      logger.error('Unexpected data type from function', { data, type: typeof data }, 'Timeline');
      return { success: false, error: 'Unexpected response format. Please try again.' };
    }

    // Check if the function returned success
    if (!result || result.success === false) {
      logger.error('Function returned unsuccessful result', { result, request }, 'Timeline');
      return {
        success: false,
        error: result?.error || 'Failed to create post. Please try again.',
      };
    }

    // Extract post_id - handle both direct property and nested structure
    const postId = result.post_id || result.data?.post_id || result.id;

    if (!postId) {
      logger.error('No post_id in function response', { result }, 'Timeline');
      return { success: false, error: 'Post created but could not retrieve ID. Please refresh.' };
    }

    const { event } = await fetchCreatedEvent(postId, 'Failed to fetch created post');
    if (!event) {
      return { success: false, error: 'Post created but could not retrieve details' };
    }
    return { success: true, event, metadata: { visibility_count: result.visibility_count || 0 } };
  } catch (error) {
    logger.error('Error creating post with visibility', { error, request }, 'Timeline');

    const err = error instanceof Error ? error : null;

    // Provide more helpful error messages
    if (err?.message?.includes('function') && err?.message?.includes('does not exist')) {
      logger.warn(
        'create_post_with_visibility function not found, falling back to legacy method',
        {},
        'Timeline'
      );
      // Fallback to legacy createEvent method
      return createEvent(request);
    }

    if (err?.message?.includes('network') || err?.message?.includes('fetch')) {
      return {
        success: false,
        error: 'Network error. Please check your connection and try again.',
      };
    }

    return {
      success: false,
      error: err?.message || 'Failed to create post. Please try again.',
    };
  }
}

/**
 * Create a new timeline event (LEGACY - prefer createEventWithVisibility for posts)
 */
export async function createEvent(
  request: CreateTimelineEventRequest
): Promise<TimelineEventResponse> {
  try {
    const actorId = await resolveActorId(request.actorId);
    if (!actorId) {
      return { success: false, error: 'Authentication required' };
    }

    const validation = validateEventRequest(request);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const safeTitle = buildSafeTitle(request.title, request.description);

    const eventData = {
      p_event_type: request.eventType || 'post_created',
      p_subject_type: request.subjectType || 'profile',
      p_title: safeTitle,
      p_event_subtype: request.eventSubtype || null,
      p_actor_id: actorId,
      p_actor_type: 'user' as const,
      p_subject_id: request.subjectId || null,
      p_target_type: request.targetType || null,
      p_target_id: request.targetId || null,
      p_description: request.description || null,
      p_content: request.content || {},
      p_amount_btc: request.amountBtc || null,
      p_quantity: request.quantity || null,
      p_visibility: request.visibility || 'public',
      p_is_featured: request.isFeatured || false,
      p_metadata: request.metadata || {},
      p_tags: request.tags || [],
      p_parent_event_id: request.parentEventId || null,
      p_thread_id: request.threadId || null,
    };

    // Create event using database function
    let eventId: string;

    try {
      const { data, error } = await callRpc(supabase, 'create_timeline_event', eventData);

      if (error) {
        logger.error('Failed to create timeline event', error, 'Timeline');
        return { success: false, error: error.message };
      }

      eventId = data;
    } catch (dbError) {
      logger.error('Failed to execute timeline creation RPC', dbError, 'Timeline');
      return { success: false, error: 'Timeline service unavailable' };
    }

    const { event } = await fetchCreatedEvent(eventId, 'Failed to fetch created timeline event');
    if (!event) {
      return { success: false, error: 'Event created but could not retrieve details' };
    }
    await handlePostCreationHooks(event);
    return { success: true, event };
  } catch (error) {
    logger.error('Error creating timeline event', error, 'Timeline');
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Create project-related events automatically
 */
export async function createProjectEvent(
  projectId: string,
  eventType: TimelineEventType,
  userId: string,
  additionalData?: Partial<CreateTimelineEventRequest>
): Promise<TimelineEventResponse> {
  // Get project details

  const { data: project } = await supabase
    .from(getTableName('project'))
    .select('title, description, goal_amount, currency')
    .eq('id', projectId)
    .single<{
      title: string;
      description: string | null;
      goal_amount?: number;
      currency?: string;
    }>();

  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  const title = generateProjectEventTitle(eventType, project.title, additionalData);
  const description = generateProjectEventDescription(eventType, project, additionalData);

  return createEvent({
    eventType,
    actorId: userId,
    subjectType: 'project',
    subjectId: projectId,
    title,
    description,
    visibility: 'public',
    isFeatured: shouldFeatureProjectEvent(eventType),
    metadata: {
      project_title: project.title,
      project_goal: project.goal_amount,
      project_currency: project.currency,
      ...additionalData?.metadata,
    },
    ...additionalData,
  });
}

/**
 * Create transaction-related events
 */
export async function createTransactionEvent(
  transactionId: string,
  projectId: string,
  supporterId: string,
  amountBtc: number,
  eventType: 'support_received' | 'support_sent' = 'support_received'
): Promise<TimelineEventResponse> {
  // Get transaction and project details
  const { data: transaction } = await supabase
    .from(DATABASE_TABLES.TRANSACTIONS)
    .select('*')
    .eq('id', transactionId)
    .single();

  const { data: project } = await supabase
    .from(getTableName('project'))
    .select('title')
    .eq('id', projectId)
    .single();

  const { data: supporter } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('username, display_name:name')
    .eq('id', supporterId)
    .single();

  if (!transaction || !project) {
    return { success: false, error: 'Transaction or project not found' };
  }

  const title =
    eventType === 'support_received'
      ? `Received ₿${amountBtc.toFixed(6)} contribution`
      : `Sent ₿${amountBtc.toFixed(6)} contribution`;

  const description =
    eventType === 'support_received'
      ? `${supporter?.display_name || supporter?.username || 'Anonymous'} contributed ₿${amountBtc.toFixed(6)} to ${project.title}`
      : `Contributed ₿${amountBtc.toFixed(6)} to ${project.title}`;

  return createEvent({
    eventType,
    actorId: supporterId,
    subjectType: 'transaction',
    subjectId: transactionId,
    targetType: 'project',
    targetId: projectId,
    title,
    description,
    amountBtc,
    visibility: 'public',
    metadata: {
      transaction_id: transactionId,
      project_id: projectId,
      project_title: project.title,
      supporter_name: supporter?.display_name || supporter?.username,
      is_anonymous: !supporter?.display_name && !supporter?.username,
    },
  });
}

/**
 * Create a quote reply (different from quote repost)
 * Quote replies create threaded conversations for networked thoughts
 */
export async function createQuoteReply(
  parentPostId: string,
  actorId: string,
  content: string,
  quotedContent: string,
  visibility: TimelineVisibility = 'public',
  getEventById?: (
    eventId: string
  ) => Promise<{ success: boolean; event?: TimelineEvent | TimelineDisplayEvent; error?: string }>
): Promise<TimelineEventResponse> {
  try {
    const result = await callRpc(supabase, 'create_quote_reply', {
      p_parent_event_id: parentPostId,
      p_actor_id: actorId,
      p_content: content,
      p_quoted_content: quotedContent,
      p_visibility: visibility,
    });

    if (result.error) {
      logger.error('Failed to create quote reply', result.error, 'Timeline');
      return { success: false, error: result.error.message };
    }

    if (!result.data) {
      return { success: false, error: 'Failed to create quote reply' };
    }

    // Fetch the created event
    if (getEventById) {
      const eventResult = await getEventById(result.data);
      if (!eventResult.success || !eventResult.event) {
        return { success: false, error: 'Quote reply created but failed to fetch' };
      }
      return { success: true, event: eventResult.event };
    }

    const { event } = await fetchCreatedEvent(result.data, 'Failed to fetch quote reply');
    if (!event) {
      return { success: false, error: 'Quote reply created but failed to fetch' };
    }
    return { success: true, event };
  } catch (error) {
    logger.error('Error creating quote reply', error, 'Timeline');
    return { success: false, error: 'Failed to create quote reply. Please try again.' };
  }
}
