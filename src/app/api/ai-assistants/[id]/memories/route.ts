/**
 * What a companion remembers about YOU.
 *
 * GET    /api/ai-assistants/[id]/memories            — list, newest first
 * DELETE /api/ai-assistants/[id]/memories?id=<uuid>  — forget one
 * DELETE /api/ai-assistants/[id]/memories?all=true   — forget everything
 *
 * Always scoped to the caller: the companion's creator has no route to
 * another person's memories, by RLS and by these handlers.
 */

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
