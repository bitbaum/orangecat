/**
 * POST /api/research/:id/nostr — record a Nostr event the researcher signed
 * with their own key (NIP-07) and already published to relays.
 *
 * Thin: the server never signs and never publishes; it verifies the signature
 * and that the event is about this research (@/domain/research/nostr).
 */

import { NextRequest } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiForbidden,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { recordResearchOnNostr } from '@/domain/research/nostr.server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

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
    const body = (await (request as NextRequest).json().catch(() => null)) as {
      event?: unknown;
    } | null;
    const result = await recordResearchOnNostr(supabase, id, user.id, body?.event);
    if (result.ok) {
      return apiSuccess(result.data);
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
