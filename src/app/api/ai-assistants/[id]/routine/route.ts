/**
 * A bot's routine: when it writes first, and what it is asked.
 *
 * GET    /api/ai-assistants/[id]/routine — the routine, if any, and whether it can run
 * PUT    /api/ai-assistants/[id]/routine — set it: { prompt, timeLocal, zone }
 * DELETE /api/ai-assistants/[id]/routine — remove it
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
import { createApiKeyService } from '@/services/ai/api-key-service';
import {
  ROUTINE_PROMPT_MAX,
  deleteRoutine,
  getRoutine,
  isTimeLocal,
  upsertRoutine,
} from '@/services/companions/routines-store';
import { isValidTimeZone } from '@/utils/timezone';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const routineSchema = z.object({
  prompt: z.string().trim().min(1).max(ROUTINE_PROMPT_MAX),
  timeLocal: z.string().refine(isTimeLocal, 'A time of day as HH:MM'),
  zone: z.string().refine(isValidTimeZone, 'A time zone'),
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
    const [routine, key] = await Promise.all([
      getRoutine(request.supabase, request.user.id, id),
      createApiKeyService(request.supabase).getDecryptedKey(request.user.id, 'openrouter'),
    ]);
    return apiSuccess({ routine, canRun: Boolean(key) });
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
    const routine = await upsertRoutine(request.supabase, request.user.id, id, parsed.data);
    const key = await createApiKeyService(request.supabase).getDecryptedKey(
      request.user.id,
      'openrouter'
    );
    return apiSuccess({ routine, canRun: Boolean(key) });
  } catch (error) {
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
    await deleteRoutine(request.supabase, request.user.id, id);
    return apiNoContent();
  } catch (error) {
    logger.error('routine delete failed', error, 'CompanionRoutineAPI');
    return apiInternalError('Failed to remove the routine');
  }
});
