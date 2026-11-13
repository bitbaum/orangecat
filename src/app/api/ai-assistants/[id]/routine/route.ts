/**
 * A bot's routines: when it writes first, and what it is asked each time.
 *
 * GET    /api/ai-assistants/[id]/routine — its routines and whether they can run
 * PUT    /api/ai-assistants/[id]/routine — { id?, prompt, timeLocal, zone, everyHours? }:
 *        with an id that routine is changed, without one a new routine is added
 * DELETE /api/ai-assistants/[id]/routine?routine=<id> — stop that one; with no id, all
 *
 * Every answer carries the whole list (`routines`), and `routine`, the first
 * of it, which is what a client from before a bot could hold several reads.
 *
 * Owner only (RLS answers on the bot); a routine runs only on the owner's
 * own key, which `canRun` reports so the details can say so.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiInternalError,
  apiNoContent,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getValidationError, validateUUID } from '@/lib/api/validation';
import { DATABASE_TABLES } from '@/config/database-tables';
import {
  ROUTINE_PROMPT_MAX,
  ROUTINES_PER_BOT,
  RoutineLimitError,
  deleteRoutine,
  isRoutineInterval,
  isTimeLocal,
  saveRoutine,
} from '@/services/companions/routines-store';
import { routinesView } from '@/services/companions/routines-view';
import { isValidTimeZone } from '@/utils/timezone';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const routineSchema = z.object({
  /** The routine to change; absent = a new one. */
  id: z.string().uuid().nullable().optional(),
  prompt: z.string().trim().min(1).max(ROUTINE_PROMPT_MAX),
  timeLocal: z.string().refine(isTimeLocal, 'A time of day as HH:MM'),
  zone: z.string().refine(isValidTimeZone, 'A time zone'),
  /** Repeat through the day, every this many hours; absent or null = once a day. */
  everyHours: z.number().refine(isRoutineInterval, 'How often, in hours').nullable().optional(),
});

async function ownBot(request: AuthenticatedRequest, id: string): Promise<boolean> {
  const { data } = await request.supabase
    .from(DATABASE_TABLES.AI_ASSISTANTS)
    .select('id')
    .eq('id', id)
    .eq('user_id', request.user.id)
    .maybeSingle();
  return Boolean(data);
}

export const GET = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'assistant ID'));
  if (invalid) {
    return invalid;
  }
  try {
    if (!(await ownBot(request, id))) {
      return apiNotFound('Bot not found');
    }
    return apiSuccess(await routinesView(request.supabase, request.user.id, id));
  } catch (error) {
    logger.error('routine load failed', error, 'CompanionRoutineAPI');
    return apiInternalError('Failed to load the routine');
  }
});

export const PUT = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'assistant ID'));
  if (invalid) {
    return invalid;
  }
  try {
    const rl = await rateLimitWriteAsync(request.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const parsed = routineSchema.safeParse(await (request as NextRequest).json());
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid request data');
    }
    if (!(await ownBot(request, id))) {
      return apiNotFound('Bot not found');
    }
    const { id: routineId, ...input } = parsed.data;
    const saved = await saveRoutine(request.supabase, request.user.id, id, input, routineId);
    if (!saved) {
      return apiNotFound('Routine not found');
    }
    return apiSuccess(await routinesView(request.supabase, request.user.id, id));
  } catch (error) {
    if (error instanceof RoutineLimitError) {
      return apiBadRequest(`A bot can have ${ROUTINES_PER_BOT} routines. Stop one to add another.`);
    }
    logger.error('routine save failed', error, 'CompanionRoutineAPI');
    return apiInternalError('Failed to save the routine');
  }
});

export const DELETE = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'assistant ID'));
  if (invalid) {
    return invalid;
  }
  try {
    const rl = await rateLimitWriteAsync(request.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const routineId = new URL((request as NextRequest).url).searchParams.get('routine');
    if (routineId) {
      const bad = getValidationError(validateUUID(routineId, 'routine ID'));
      if (bad) {
        return bad;
      }
    }
    await deleteRoutine(request.supabase, request.user.id, id, routineId);
    return apiNoContent();
  } catch (error) {
    logger.error('routine delete failed', error, 'CompanionRoutineAPI');
    return apiInternalError('Failed to remove the routine');
  }
});
