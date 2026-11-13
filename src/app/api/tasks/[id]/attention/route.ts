/**
 * Task Attention Flag API
 *
 * POST /api/tasks/[id]/attention - Flag a task as needing attention
 *
 * Created: 2026-02-05
 */

import { apiNotFound, apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { createTaskActionRoute } from '@/lib/api/taskActionRoute';
import { DATABASE_TABLES } from '@/config/database-tables';
import { attentionFlagSchema } from '@/lib/schemas/tasks';
import { TASK_STATUSES } from '@/config/tasks';
import { NotificationService } from '@/lib/services/notifications';
import { logger } from '@/utils/logger';

export const POST = createTaskActionRoute({
  schema: attentionFlagSchema,
  routeName: 'POST /api/tasks/[id]/attention',
  handler: async ({ taskId, user, supabase, data: flagData }) => {
    const { data: task, error: taskError } = await supabase
      .from(DATABASE_TABLES.TASKS)
      .select('id, title, created_by')
      .eq('id', taskId)
      .single();

    if (taskError) {
      if (taskError.code === 'PGRST116') {
        return apiNotFound('Task not found');
      }
      logger.error('Failed to fetch task', { error: taskError, taskId }, 'TasksAPI');
      return apiInternalError();
    }

    const { data: flag, error: flagError } = await supabase
      .from(DATABASE_TABLES.TASK_ATTENTION_FLAGS)
      .insert({ task_id: taskId, flagged_by: user.id, message: flagData.message || null })
      .select('id, flagged_by, message, created_at')
      .single();

    if (flagError) {
      logger.error('Failed to create attention flag', { error: flagError, taskId }, 'TasksAPI');
      return apiInternalError('Failed to flag task');
    }

    await supabase
      .from(DATABASE_TABLES.TASKS)
      .update({ current_status: TASK_STATUSES.NEEDS_ATTENTION })
      .eq('id', taskId);

    const { data: profile } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('username, display_name:name')
      .eq('id', user.id)
      .single();
    const flaggerName = profile?.display_name || profile?.username || 'Someone';
    const notificationService = new NotificationService(supabase);

    if (task.created_by !== user.id) {
      await notificationService.createNotification({
        recipientUserId: task.created_by,
        type: 'task_attention',
        title: `${flaggerName} says: "${task.title}" needs attention`,
        message: flagData.message || null,
        actionUrl: `/dashboard/tasks/${taskId}`,
        sourceEntityType: 'task',
        sourceEntityId: taskId,
      });
    }

    return apiSuccess({ flag }, { status: 201 });
  },
});
