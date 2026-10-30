/**
 * DELETE /api/ai-assistants/rooms/[roomId]/members/[memberId] — a companion
 * leaves the group chat. Its lines stay, in its name. A group keeps at least
 * two; below that it is not a group, and the person deletes the chat instead.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiInternalError,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getValidationError, validateUUID } from '@/lib/api/validation';
import { MIN_ROOM_MEMBERS } from '@/services/companions/rooms/plan';
import { getRoom, removeRoomMember } from '@/services/companions/rooms/store';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ roomId: string; memberId: string }>;
}

export const DELETE = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { roomId, memberId } = await context.params;
  const invalid =
    getValidationError(validateUUID(roomId, 'room ID')) ??
    getValidationError(validateUUID(memberId, 'member ID'));
  if (invalid) {
    return invalid;
  }
  try {
    const rl = await rateLimitWriteAsync(request.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const room = await getRoom(request.supabase, roomId);
    if (!room) {
      return apiNotFound('Group chat not found');
    }
    if (!room.members.some(m => m.id === memberId)) {
      return apiNotFound('Not in this group chat');
    }
    if (room.members.length <= MIN_ROOM_MEMBERS) {
      return apiBadRequest(`A group chat keeps at least ${MIN_ROOM_MEMBERS} companions`);
    }
    return apiSuccess({ members: await removeRoomMember(request.supabase, roomId, memberId) });
  } catch (error) {
    logger.error('room member remove failed', error, 'CompanionRoomsAPI');
    return apiInternalError('Failed to remove the companion');
  }
});
