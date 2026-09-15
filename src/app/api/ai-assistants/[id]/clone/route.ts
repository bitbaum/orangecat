/**
 * POST /api/ai-assistants/[id]/clone — make a private copy of a companion.
 *
 * Copies the definition only (see services/companions/clone.ts). The source
 * must be readable by the caller under RLS: public and active, or their own.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiCreated,
  apiNotFound,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { cloneCompanion } from '@/services/companions/clone';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const idError = getValidationError(validateUUID(id, 'companion ID'));
  if (idError) {
    return idError;
  }
  const { user, supabase } = request;
  const rl = await rateLimitWriteAsync(user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }
  try {
    const result = await cloneCompanion(supabase, user.id, id);
    if (result.ok) {
      return apiCreated(result.data);
    }
    if ('notFound' in result) {
      return apiNotFound('Companion not found');
    }
    logger.error('Clone companion failed', result.dbError, 'CompanionCloneAPI');
    return apiInternalError('Could not clone this companion right now.');
  } catch (error) {
    logger.error('Clone companion error', error, 'CompanionCloneAPI');
    return apiInternalError();
  }
});
