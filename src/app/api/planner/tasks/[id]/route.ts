/**
 * PATCH /api/planner/tasks/[id] — move one of your own tasks to another day,
 * or to no day: { day: "YYYY-MM-DD" | null, zone? }
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiInternalError,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getValidationError, validateUUID } from '@/lib/api/validation';
import { dueInstant, updateTask } from '@/services/planner/tasks';
import { logger } from '@/utils/logger';
import { plannerZone } from '@/services/planner/zone';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const moveSchema = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  zone: z.string().optional().nullable(),
});

export const PATCH = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
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
    const parsed = moveSchema.safeParse(await (request as NextRequest).json());
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid request data');
    }
    const { day, zone } = parsed.data;
    const moved = await updateTask(request.supabase, request.user.id, {
      task_id: id,
      // An empty date is "no date": the parser reads it as none.
      due_date: day
        ? (dueInstant(day, await plannerZone(request.supabase, request.user.id, zone)) ?? '')
        : '',
    });
    return moved.success ? apiSuccess({ id, day }) : apiNotFound('Task not found');
  } catch (error) {
    logger.error('task move failed', error, 'PlannerTasksAPI');
    return apiInternalError('That could not be changed');
  }
});
