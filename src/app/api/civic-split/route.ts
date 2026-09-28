/**
 * Civic split — the signed-in person's own declaration.
 *
 * GET    /api/civic-split  the caller's split, or null if they have not declared
 * PUT    /api/civic-split  declare or change it (one row per actor)
 * DELETE /api/civic-split  withdraw it
 *
 * Thin: the shape lives in @/domain/civic-split/schema, the I/O in the service,
 * and RLS decides whose row this is.
 */
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiBadRequest,
  apiNotFound,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getUserActorId } from '@/domain/actors';
import { civicSplitInputSchema } from '@/domain/civic-split/schema';
import { deleteCivicSplit, getCivicSplit, saveCivicSplit } from '@/domain/civic-split/service';
import { logger } from '@/utils/logger';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const actorId = await getUserActorId(req.supabase, req.user.id);
    if (!actorId) {
      return apiNotFound('Actor');
    }
    return apiSuccess({ split: await getCivicSplit(req.supabase, actorId) });
  } catch (error) {
    logger.error('Civic split GET failed', { error }, 'CivicSplit');
    return handleApiError(error);
  }
});

export const PUT = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const rl = await rateLimitWriteAsync(req.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const parsed = civicSplitInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiBadRequest('Invalid split', parsed.error.flatten());
    }
    const actorId = await getUserActorId(req.supabase, req.user.id);
    if (!actorId) {
      return apiNotFound('Actor');
    }
    return apiSuccess({ split: await saveCivicSplit(req.supabase, actorId, parsed.data) });
  } catch (error) {
    logger.error('Civic split PUT failed', { error }, 'CivicSplit');
    return handleApiError(error);
  }
});

export const DELETE = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const actorId = await getUserActorId(req.supabase, req.user.id);
    if (!actorId) {
      return apiNotFound('Actor');
    }
    await deleteCivicSplit(req.supabase, actorId);
    return apiSuccess({ split: null });
  } catch (error) {
    logger.error('Civic split DELETE failed', { error }, 'CivicSplit');
    return handleApiError(error);
  }
});
