/**
 * PUT /api/projects/[id]/room/deck — save the room's deck (@bitbaum/deckkit
 * data). Owner only; the body is read through normalizeDeck, so whatever is
 * stored is a deck that renders.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiRateLimited, apiValidationError, handleApiError } from '@/lib/api/standardResponse';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { saveRoomDeck } from '@/domain/projectRooms/deck';
import { roomResponse } from '../respond';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** A deck is small data; anything this size is not one. */
const MAX_BYTES = 200_000;

export const PUT = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  try {
    const rl = await rateLimitWriteAsync(request.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const { id } = await context.params;
    const invalid = getValidationError(validateUUID(id, 'project ID'));
    if (invalid) {
      return invalid;
    }
    const raw = await request.text();
    if (raw.length > MAX_BYTES) {
      return apiValidationError('The deck is too large');
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return apiValidationError('The deck is not valid JSON');
    }
    return roomResponse(await saveRoomDeck(id, request.user.id, request.supabase, body));
  } catch (error) {
    return handleApiError(error);
  }
});
