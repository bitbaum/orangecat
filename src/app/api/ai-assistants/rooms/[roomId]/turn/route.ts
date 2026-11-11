/**
 * POST /api/ai-assistants/rooms/[roomId]/turn — the next member of the round speaks.
 *
 * Takes the `round` the last answer handed back, re-checks it against the
 * room (a forged queue cannot seat a stranger), lets one member speak and
 * returns the round that is left. An empty queue is a finished round, 200 with
 * no message, so the client never has to guess whether to call again.
 */

import type { NextRequest } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiInternalError,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { applyRateLimitHeaders, rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getValidationError, validateUUID } from '@/lib/api/validation';
import { roomTurnSchema } from '@/lib/api/companion-rooms';
import { sanitizeRound } from '@/services/companions/rooms/plan';
import { stepRound } from '@/services/companions/rooms/round';
import { getRoom } from '@/services/companions/rooms/store';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { roomId } = await context.params;
  const invalid = getValidationError(validateUUID(roomId, 'room ID'));
  if (invalid) {
    return invalid;
  }
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return applyRateLimitHeaders(
        apiRateLimited('Rate limit exceeded', retryAfterSeconds(rl)),
        rl
      );
    }
    const parsed = roomTurnSchema.safeParse(await (request as NextRequest).json());
    if (!parsed.success) {
      return apiBadRequest('Validation failed', parsed.error.flatten());
    }
    const room = await getRoom(supabase, roomId);
    if (!room) {
      return apiNotFound('Group chat not found');
    }
    const state = sanitizeRound(parsed.data.round, room.members);
    if (state.queue.length === 0) {
      return apiSuccess({ messages: [], failed: null, round: { queue: [], turnsLeft: 0 } });
    }
    const step = await stepRound({ supabase, userId: user.id, room, state });
    return applyRateLimitHeaders(
      apiSuccess({
        messages: step.message ? [step.message] : [],
        failed: step.failed,
        round: step.state,
      }),
      rl
    );
  } catch (error) {
    logger.error('room turn failed', error, 'CompanionRoomsAPI');
    return apiInternalError();
  }
});
