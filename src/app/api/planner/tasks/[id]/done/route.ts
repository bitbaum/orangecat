/**
 * POST /api/planner/tasks/[id]/done — tick one of your own tasks off.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiInternalError,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getValidationError, validateUUID } from '@/lib/api/validation';
import { completeTask } from '@/services/planner/tasks';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'task ID'));
  if (invalid) {
    return invalid;
  }
  try {
    const rl = await rateLimitWriteAsync(request.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const done = await completeTask(request.supabase, request.user.id, { task_id: id });
    return done.success ? apiSuccess({ id }) : apiNotFound('Task not found');
  } catch (error) {
    logger.error('task done failed', error, 'PlannerTasksAPI');
    return apiInternalError('That could not be ticked off');
  }
});
