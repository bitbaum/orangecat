/**
 * POST /api/deal-reviews/:id/reports — anyone signed in reports a public review
 * to the operator (ADR-0010). Body: { reason: string }.
 *
 * Reporting hides nothing by itself; the operator decides. Once per person per
 * review.
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
import { getUserActorId } from '@/domain/actors';
import { reportReview } from '@/domain/reputation/track-record';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'review ID'));
  if (invalid) {
    return invalid;
  }
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const actorId = await getUserActorId(supabase, user.id);
    if (!actorId) {
      return apiNotFound('Actor');
    }
    const input = await (request as NextRequest).json().catch(() => null);
    const result = await reportReview(supabase, actorId, id, input);
    if (result.ok) {
      return apiCreated({ reported: true });
    }
    if (result.code === 'not_found') {
      return apiNotFound(result.message);
    }
    return result.code === 'conflict' ? apiConflict(result.message) : apiBadRequest(result.message);
  } catch (error) {
    return handleApiError(error);
  }
});
