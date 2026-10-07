/**
 * Task Domain Service
 *
 * Business logic for updating and archiving tasks, extracted from the API route.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  apiForbidden,
  apiNotFound,
  apiInternalError,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { TaskUpdateInput } from '@/lib/schemas/tasks';
import { logger } from '@/utils/logger';
import type { NextResponse } from 'next/server';

type AnyResponse = NextResponse<unknown>;

/** Map validated update input to DB column update object. */
export function buildTaskUpdates(updateData: TaskUpdateInput): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (updateData.title !== undefined) {
    updates.title = updateData.title;
  }
  if (updateData.description !== undefined) {
    updates.description = updateData.description || null;
  }
  if (updateData.instructions !== undefined) {
    updates.instructions = updateData.instructions || null;
  }
  if (updateData.task_type !== undefined) {
    updates.task_type = updateData.task_type;
  }
  if (updateData.schedule_cron !== undefined) {
    updates.schedule_cron = updateData.schedule_cron || null;
  }
  if (updateData.schedule_human !== undefined) {
    updates.schedule_human = updateData.schedule_human || null;
  }
  if (updateData.category !== undefined) {
    updates.category = updateData.category;
  }
  if (updateData.tags !== undefined) {
    updates.tags = updateData.tags;
  }
  if (updateData.priority !== undefined) {
    updates.priority = updateData.priority;
  }
  if (updateData.estimated_minutes !== undefined) {
    updates.estimated_minutes = updateData.estimated_minutes || null;
  }
  if (updateData.project_id !== undefined) {
    updates.project_id = updateData.project_id || null;
  }
  if (updateData.current_status !== undefined) {
    updates.current_status = updateData.current_status;
  }
  if (updateData.is_archived !== undefined) {
    updates.is_archived = updateData.is_archived;
  }

  return updates;
}

/** Apply updates to a task and return the updated record. */
export async function updateTask(
  supabase: SupabaseClient,
  id: string,
  updates: Record<string, unknown>
): Promise<AnyResponse> {
  const { data: task, error } = await supabase
    .from(DATABASE_TABLES.TASKS)
    .update(updates)
    .eq('id', id)
    .select('*, project:task_projects(id, title, status)')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return apiNotFound('Task not found');
    }
    logger.error('Failed to update task', { error, id }, 'TasksAPI');
    return apiInternalError('Failed to update task');
  }
  return apiSuccess({ task });
}

/** Verify ownership then soft-delete (archive) a task. */
export async function archiveTask(
  supabase: SupabaseClient,
  id: string,
  userId: string
): Promise<AnyResponse> {
  const { data: existing, error: fetchError } = await supabase
    .from(DATABASE_TABLES.TASKS)
    .select('created_by')
    .eq('id', id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return apiNotFound('Task not found');
    }
    logger.error('Failed to fetch task for deletion', { error: fetchError, id }, 'TasksAPI');
    return apiInternalError();
  }

  if ((existing as { created_by: string }).created_by !== userId) {
    return apiForbidden('Only the creator can archive this task');
  }

  const { error } = await supabase
    .from(DATABASE_TABLES.TASKS)
    .update({ is_archived: true })
    .eq('id', id);

  if (error) {
    logger.error('Failed to archive task', { error, id }, 'TasksAPI');
    return apiInternalError('Failed to archive task');
  }
  return apiSuccess(null);
}
