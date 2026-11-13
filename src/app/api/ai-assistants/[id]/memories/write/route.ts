/**
 * A memory the person writes or corrects themselves.
 *
 * POST  /api/ai-assistants/[id]/memories/write — add one: { content }
 * PATCH /api/ai-assistants/[id]/memories/write — correct one: { id, content }
 *
 * Apart from the list and forget route on purpose: storing a memory embeds
 * its words, and a file a GET lives in may not import that
 * (__tests__/unit/ci/no-background-ai). Scoped to the caller, like the rest.
 */

import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import {
  listCompanionMemories,
  writeCompanionMemory,
  MAX_MEMORY_CHARS,
} from '@/services/companions/memory';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const writeSchema = z.object({
  id: z.string().uuid().optional(),
  content: z.string().trim().min(3).max(MAX_MEMORY_CHARS),
});

/** Add a memory the person wrote (POST), or correct one (PATCH, with its id). */
async function write(request: AuthenticatedRequest, context: RouteContext, needsId: boolean) {
  const { id: assistantId } = await context.params;
  const idError = getValidationError(validateUUID(assistantId, 'companion ID'));
  if (idError) {
    return idError;
  }
  const { user, supabase } = request;
  const rl = await rateLimitWriteAsync(user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }
  const parsed = writeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (needsId && !parsed.data.id)) {
    return apiBadRequest(
      `A memory is 3 to ${MAX_MEMORY_CHARS} characters${needsId ? ', and a correction names the memory it replaces' : ''}.`
    );
  }
  try {
    const stored = await writeCompanionMemory(
      supabase,
      { assistantId, userId: user.id },
      parsed.data.content,
      needsId ? parsed.data.id : undefined
    );
    if (!stored) {
      return apiInternalError('That could not be remembered just now.');
    }
    const memories = await listCompanionMemories(supabase, { assistantId, userId: user.id });
    return apiSuccess({ memories });
  } catch (error) {
    logger.error('Write companion memory error', error, 'CompanionMemoriesAPI');
    return apiInternalError();
  }
}

export const POST = withAuth((request: AuthenticatedRequest, context: RouteContext) =>
  write(request, context, false)
);

export const PATCH = withAuth((request: AuthenticatedRequest, context: RouteContext) =>
  write(request, context, true)
);
