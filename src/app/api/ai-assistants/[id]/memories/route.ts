/**
 * What a companion remembers about YOU.
 *
 * GET    /api/ai-assistants/[id]/memories            — list, newest first
 * POST   /api/ai-assistants/[id]/memories            — add one the person wrote: { content }
 * PATCH  /api/ai-assistants/[id]/memories            — correct one: { id, content }
 * DELETE /api/ai-assistants/[id]/memories?id=<uuid>  — forget one
 * DELETE /api/ai-assistants/[id]/memories?all=true   — forget everything
 *
 * Always scoped to the caller: the companion's creator has no route to
 * another person's memories, by RLS and by these handlers.
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
  deleteCompanionMemory,
  deleteAllCompanionMemories,
  writeCompanionMemory,
  MAX_MEMORY_CHARS,
} from '@/services/companions/memory';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id: assistantId } = await context.params;
  const idError = getValidationError(validateUUID(assistantId, 'companion ID'));
  if (idError) {
    return idError;
  }
  const { user, supabase } = request;
  try {
    const memories = await listCompanionMemories(supabase, { assistantId, userId: user.id });
    return apiSuccess({ memories });
  } catch (error) {
    logger.error('List companion memories error', error, 'CompanionMemoriesAPI');
    return apiInternalError();
  }
});

export const DELETE = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
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
  const { searchParams } = new URL(request.url);
  const memoryId = searchParams.get('id');
  const all = searchParams.get('all') === 'true';
  try {
    if (all) {
      const ok = await deleteAllCompanionMemories(supabase, { assistantId, userId: user.id });
      return ok ? apiSuccess({ success: true }) : apiInternalError('Failed to forget');
    }
    if (memoryId) {
      const memError = getValidationError(validateUUID(memoryId, 'memory ID'));
      if (memError) {
        return memError;
      }
      const ok = await deleteCompanionMemory(supabase, user.id, memoryId);
      return ok ? apiSuccess({ success: true }) : apiInternalError('Failed to forget');
    }
    return apiBadRequest('Provide ?id=<id> or ?all=true');
  } catch (error) {
    logger.error('Delete companion memory error', error, 'CompanionMemoriesAPI');
    return apiInternalError();
  }
});

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
