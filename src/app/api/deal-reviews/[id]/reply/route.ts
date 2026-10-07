/**
 * POST /api/deal-reviews/:id/reply — the seller answers a public review about
 * them, once (ADR-0010). Body: { body: string }.
 *
 * Thin: the database allows only the person the review is about, only on a
 * public review, only once, and never an edit.
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
import { replyToReview } from '@/domain/reputation/track-record';

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
    const input = await (request as NextRequest).json().catch(() => null);
    const result = await replyToReview(
      supabase,
      await getUserActorIds(supabase, user.id),
      id,
      input
    );
    if (result.ok) {
      return apiCreated({ replied: true });
    }
    if (result.code === 'not_found') {
      return apiNotFound(result.message);
    }
    return result.code === 'conflict' ? apiConflict(result.message) : apiBadRequest(result.message);
  } catch (error) {
    return handleApiError(error);
  }
});
