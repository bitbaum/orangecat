/**
 * Task Request API
 *
 * POST /api/tasks/[id]/request - Request someone to do a task
 *
 * Asks one named person. There is no broadcast: a request with no one named
 * used to notify every account on the platform.
 */

import { apiNotFound, apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { createTaskActionRoute } from '@/lib/api/taskActionRoute';
import { DATABASE_TABLES } from '@/config/database-tables';
import { taskRequestSchema } from '@/lib/schemas/tasks';
import { TASK_STATUSES, REQUEST_STATUSES } from '@/config/tasks';
import { NotificationService } from '@/lib/services/notifications';
import { logger } from '@/utils/logger';

export const POST = createTaskActionRoute({
  schema: taskRequestSchema,
  routeName: 'POST /api/tasks/[id]/request',
  handler: async ({ taskId, user, supabase, data: d }) => {
    // Verify task exists
    const { data: task, error: taskError } = await supabase
      .from(DATABASE_TABLES.TASKS)
      .select('id, title')
      .eq('id', taskId)
      .single();
    if (taskError) {
      return taskError.code === 'PGRST116' ? apiNotFound('Task not found') : apiInternalError();
    }

    // The person asked must exist
    const { data: target, error: userError } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('id')
      .eq('id', d.requested_user_id)
      .single();
    if (userError || !target) {
      return apiNotFound('Requested user not found');
    }

    const { data: taskRequest, error: requestError } = await supabase
      .from(DATABASE_TABLES.TASK_REQUESTS)
      .insert({
        task_id: taskId,
        requested_by: user.id,
        requested_user_id: d.requested_user_id,
        message: d.message || null,
        status: REQUEST_STATUSES.PENDING,
      })
      .select('id, requested_by, requested_user_id, message, status, is_broadcast, created_at')
      .single();

    if (requestError) {
      logger.error('Failed to create task request', { error: requestError, taskId }, 'TasksAPI');
      return apiInternalError('Failed to create request');
    }

    await supabase
      .from(DATABASE_TABLES.TASKS)
      .update({ current_status: TASK_STATUSES.REQUESTED })
      .eq('id', taskId);

    // Send notification
    const { data: profile } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('username, display_name:name')
      .eq('id', user.id)
      .single();
    const requesterName = profile?.display_name || profile?.username || 'Someone';
    const notificationService = new NotificationService(supabase);
    const notifBase = {
      title: '',
      message: d.message || null,
      actionUrl: `/dashboard/tasks/${taskId}`,
      sourceEntityType: 'task' as const,
      sourceEntityId: taskId,
    };

    await notificationService.createNotification({
      ...notifBase,
      recipientUserId: d.requested_user_id,
      type: 'task_request',
      title: `${requesterName} is asking you: "${task.title}"`,
    });

    return apiSuccess({ request: taskRequest }, { status: 201 });
  },
});
