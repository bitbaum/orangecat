/**
 * POST /api/deals/:id/reviews — review a deal you were part of (ADR-0010).
 *
 * Body: { answers: { would_deal_again: boolean, ... }, body?: string }
 *
 * Thin: the questions live in @/config/reputation and the rules in the
 * database (one per side, parties only, window open, never edited).
 */

import { NextRequest } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiConflict,
  apiCreated,
  apiNotFound,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { getUserActorIds } from '@/domain/actors';
import { createDealReview } from '@/domain/reputation/service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'deal ID'));
  if (invalid) {
    return invalid;
  }
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const input = await (request as NextRequest).json().catch(() => null);
    const actorIds = await getUserActorIds(supabase, user.id);
    const result = await createDealReview(supabase, actorIds, id, input);
    if (result.ok) {
      return apiCreated(result.review);
    }
    switch (result.code) {
      case 'not_found':
        return apiNotFound(result.message);
      case 'conflict':
      case 'closed':
        return apiConflict(result.message);
      default:
        return apiBadRequest(result.message, result.fieldErrors);
    }
  } catch (error) {
    return handleApiError(error);
  }
});
