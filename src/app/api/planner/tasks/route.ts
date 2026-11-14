/**
 * The person's own to-do list, as the planner pages use it.
 *
 * GET  /api/planner/tasks?zone=Europe/Zurich — what is open, each with the
 *      day it is due in the person's own clock
 * POST /api/planner/tasks — add one: { title, day?, zone? }
 *
 * The bodies are services/planner/tasks.ts, the same ones the Cat's cards
 * and a bot's work loop run.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { createTask, dueInstant, readOpenTasks, taskListPage } from '@/services/planner/tasks';
import { plannerZone } from '@/services/planner/zone';
import { logger } from '@/utils/logger';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const newTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  day: z.string().regex(DAY).optional().nullable(),
  zone: z.string().optional().nullable(),
});

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const zone = await plannerZone(
      request.supabase,
      request.user.id,
      new URL((request as NextRequest).url).searchParams.get('zone')
    );
    const tasks = await readOpenTasks(request.supabase, request.user.id);
    if (!tasks) {
      return apiInternalError('Your to-do list could not be loaded');
    }
    return apiSuccess(taskListPage(tasks, zone), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    logger.error('task list load failed', error, 'PlannerTasksAPI');
    return apiInternalError('Your to-do list could not be loaded');
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const rl = await rateLimitWriteAsync(request.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const parsed = newTaskSchema.safeParse(await (request as NextRequest).json());
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid request data');
    }
    const { title, day, zone } = parsed.data;
    const due = day
      ? dueInstant(day, await plannerZone(request.supabase, request.user.id, zone))
      : null;
    const made = await createTask(request.supabase, request.user.id, {
      title,
      ...(due ? { due_date: due } : {}),
    });
    return made.success
      ? apiSuccess(made.data, { status: 201 })
      : apiBadRequest(made.error ?? 'That could not be added');
  } catch (error) {
    logger.error('task add failed', error, 'PlannerTasksAPI');
    return apiInternalError('That could not be added to your list');
  }
});
