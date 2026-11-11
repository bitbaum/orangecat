/**
 * One group chat.
 *
 * GET    /api/ai-assistants/rooms/[roomId] — the room, its members and its transcript
 * PATCH  /api/ai-assistants/rooms/[roomId] — rename: { title }
 * DELETE /api/ai-assistants/rooms/[roomId] — close it; the transcript goes with it
 */

import type { NextRequest } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiInternalError,
  apiNoContent,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getValidationError, validateUUID } from '@/lib/api/validation';
import { renameRoomSchema } from '@/lib/api/companion-rooms';
import { deleteRoom, getRoom, renameRoom } from '@/services/companions/rooms/store';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ roomId: string }>;
}

async function writeLimited(userId: string) {
  const rl = await rateLimitWriteAsync(userId);
  return rl.success
    ? null
    : apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
}

export const GET = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { roomId } = await context.params;
  const invalid = getValidationError(validateUUID(roomId, 'room ID'));
  if (invalid) {
    return invalid;
  }
  try {
    const room = await getRoom(request.supabase, roomId);
    return room ? apiSuccess(room) : apiNotFound('Group chat not found');
  } catch (error) {
    logger.error('room load failed', error, 'CompanionRoomsAPI');
    return apiInternalError('Failed to load the group chat');
  }
});

export const PATCH = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { roomId } = await context.params;
  const invalid = getValidationError(validateUUID(roomId, 'room ID'));
  if (invalid) {
    return invalid;
  }
  const limited = await writeLimited(request.user.id);
  if (limited) {
    return limited;
  }
  const parsed = renameRoomSchema.safeParse(await (request as NextRequest).json());
  if (!parsed.success) {
    return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid request data');
  }
  const renamed = await renameRoom(request.supabase, roomId, parsed.data.title);
  return renamed
    ? apiSuccess({ id: roomId, title: parsed.data.title })
    : apiNotFound('Group chat not found');
});

export const DELETE = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { roomId } = await context.params;
  const invalid = getValidationError(validateUUID(roomId, 'room ID'));
  if (invalid) {
    return invalid;
  }
  const limited = await writeLimited(request.user.id);
  if (limited) {
    return limited;
  }
  const gone = await deleteRoom(request.supabase, roomId);
  return gone ? apiNoContent() : apiNotFound('Group chat not found');
});
