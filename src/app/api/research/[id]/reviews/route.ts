/**
 * Open peer review of one research entity.
 *
 * GET  /api/research/:id/reviews  reviews, newest first (RLS: public research only)
 * POST /api/research/:id/reviews  post a review as the signed-in person's actor
 *
 * Thin: shape and rules live in @/domain/research/reviews; the database makes
 * reviews append-only and refuses self-review.
 */

import { NextRequest } from 'next/server';
import { withAuth, withOptionalAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiCreated,
  apiForbidden,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { getUserActorId } from '@/domain/actors';
import {
  createResearchReview,
  listResearchReviews,
  reviewInputSchema,
} from '@/domain/research/reviews';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withOptionalAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'research entity ID'));
  if (invalid) {
    return invalid;
  }
  try {
    return apiSuccess(await listResearchReviews(request.supabase, id));
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'research entity ID'));
  if (invalid) {
    return invalid;
  }
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const parsed = reviewInputSchema.safeParse(
      await (request as NextRequest).json().catch(() => null)
    );
    if (!parsed.success) {
      return apiBadRequest('Invalid review', parsed.error.flatten().fieldErrors);
    }
    const actorId = await getUserActorId(supabase, user.id);
    if (!actorId) {
      return apiNotFound('Actor');
    }
    const result = await createResearchReview(supabase, id, user.id, actorId, parsed.data);
    if (result.ok) {
      return apiCreated(result.review);
    }
    if (result.code === 'not_found') {
      return apiNotFound(result.message);
    }
    return result.code === 'forbidden'
      ? apiForbidden(result.message)
      : apiBadRequest(result.message);
  } catch (error) {
    return handleApiError(error);
  }
});
