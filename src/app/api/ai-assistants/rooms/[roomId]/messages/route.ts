/**
 * POST /api/ai-assistants/rooms/[roomId]/messages — the person says something.
 *
 * Stores the line, decides who answers (the members addressed with @, or the
 * router's pick), lets the FIRST of them speak, and hands back the rest of
 * the round as `round` for /turn. One bot line per request, on purpose: see
 * services/companions/rooms/round.ts.
 */

import { storeChatImages } from '@/services/cat/chat-image-store';
import { withImageRefs } from '@/lib/chat/attachment-tags';
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
import { roomMessageSchema } from '@/lib/api/companion-rooms';
import { openRound, stepRound } from '@/services/companions/rooms/round';
import { appendRoomMessage, getRoom } from '@/services/companions/rooms/store';
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
    const parsed = roomMessageSchema.safeParse(await (request as NextRequest).json());
    if (!parsed.success) {
      return apiBadRequest('Validation failed', parsed.error.flatten());
    }
    const room = await getRoom(supabase, roomId);
    if (!room) {
      return apiNotFound('Group chat not found');
    }
    // A photo's pixels are stored once and read back by each member's turn.
    const { content, images } = parsed.data;
    const refs = images?.length ? await storeChatImages(user.id, images) : [];
    const userMessage = await appendRoomMessage(supabase, room.id, {
      role: 'user',
      content: withImageRefs(
        content,
        refs.filter((r): r is string => Boolean(r))
      ),
    });
    room.messages.push(userMessage);
    const opened = await openRound(room, parsed.data.content);
    const step = await stepRound({ supabase, userId: user.id, room, state: opened });
    return applyRateLimitHeaders(
      apiSuccess({
        messages: [userMessage, ...(step.message ? [step.message] : [])],
        failed: step.failed,
        round: step.state,
      }),
      rl
    );
  } catch (error) {
    logger.error('room message failed', error, 'CompanionRoomsAPI');
    return apiInternalError();
  }
});
