/**
 * Timeline Event Mutations
 *
 * Write operations for timeline events. This file holds the lifecycle ops
 * (update / delete / share) and re-exports the CREATE ops from events-create.ts,
 * so consumers (timeline/index.ts) keep importing every mutation from one place.
 * Shared helpers live in events-helpers.ts.
 *
 * Created: 2025-01-28
 * Last Modified: 2026-06-29
 * Last Modified Summary: Split create ops into events-create.ts (SoC); behavior unchanged.
 */

import { callRpc } from '@/lib/supabase/untyped';
import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { TIMELINE_TABLES } from '@/config/database-tables';
import type { TimelineVisibility } from '@/types/timeline';
import type { ServiceResult } from '@/types/common';
import { resolveActorId } from './events-helpers';
import { createEvent } from './events-create';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export {
  createEventWithVisibility,
  createEvent,
  createProjectEvent,
  createTransactionEvent,
  createQuoteReply,
} from './events-create';

/**
 * Update event content (title, description, metadata)
 */
export async function updateEvent(
  eventId: string,
  updates: {
    title?: string;
    description?: string;
    visibility?: TimelineVisibility;
    metadata?: Record<string, unknown>;
  }
): Promise<ServiceResult> {
  try {
    const updateData: Record<string, unknown> = {};

    if (updates.title !== undefined) {
      updateData.title = updates.title;
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }

    if (updates.visibility !== undefined) {
      updateData.visibility = updates.visibility;
    }

    if (updates.metadata !== undefined) {
      updateData.metadata = updates.metadata;
    }

    updateData.updated_at = new Date().toISOString();

    const { error } = await (supabase as any)
      .from(TIMELINE_TABLES.EVENTS)
      .update(updateData)
      .eq('id', eventId);

    if (error) {
      logger.error('Failed to update timeline event', error, 'Timeline');
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error updating timeline event', error, 'Timeline');
    return { success: false, error: errorMessage };
  }
}

/**
 * Update event visibility (owner only)
 */
export async function updateEventVisibility(
  eventId: string,
  visibility: TimelineVisibility
): Promise<ServiceResult> {
  return updateEvent(eventId, { visibility });
}

/**
 * Soft delete an event
 */
export async function deleteEvent(eventId: string, reason?: string): Promise<boolean> {
  try {
    const { data, error } = await callRpc(supabase, 'soft_delete_timeline_event', {
      event_id: eventId,
      reason,
    });

    if (error) {
      logger.error('Failed to delete timeline event', error, 'Timeline');
      return false;
    }

    return data || false;
  } catch (error) {
    logger.error('Error deleting timeline event', error, 'Timeline');
    return false;
  }
}

/**
 * Share an event
 * Delegates to socialInteractions processor but handles fallback
 */
export async function shareEvent(
  originalEventId: string,
  userId?: string,
  shareText?: string,
  visibility: TimelineVisibility = 'public'
): Promise<{ success: boolean; shareCount: number; error?: string }> {
  try {
    const actorId = await resolveActorId(userId);
    if (!actorId) {
      return { success: false, shareCount: 0, error: 'Authentication required' };
    }

    // Create a share event referencing the original
    const fallback = await createEvent({
      eventType: 'post_shared',
      actorId,
      subjectType: 'profile',
      title: 'Shared a post',
      description: shareText || 'Shared from timeline',
      metadata: { original_event_id: originalEventId },
      visibility,
    });

    if (!fallback.success) {
      return { success: false, shareCount: 0, error: apiErrorMessage(fallback, 'Share failed') };
    }

    // Attempt to count share events referencing this original
    const { count } = await supabase
      .from(TIMELINE_TABLES.EVENTS)
      .select('id', { count: 'exact', head: true })
      .contains('metadata', { original_event_id: originalEventId });

    return { success: true, shareCount: count || 0 };
  } catch (error) {
    logger.error('Error sharing timeline event', error, 'Timeline');
    return { success: false, shareCount: 0, error: 'Internal server error' };
  }
}
