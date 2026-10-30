/**
 * POST /api/ai-assistants/rooms/[roomId]/members — one more companion joins:
 * { assistantId } | { fleetSlug }. A room holds at most six, each once, and
 * only a companion the person may talk to (their own, or public and active —
 * RLS answers on the read).
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
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getValidationError, validateUUID } from '@/lib/api/validation';
import { roomMemberSchema } from '@/lib/api/companion-rooms';
import { DATABASE_TABLES } from '@/config/database-tables';
import { MAX_ROOM_MEMBERS } from '@/services/companions/rooms/plan';
import { addRoomMember, getRoom } from '@/services/companions/rooms/store';
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
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const parsed = roomMemberSchema.safeParse(await (request as NextRequest).json());
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid request data');
    }
    const room = await getRoom(supabase, roomId);
    if (!room) {
      return apiNotFound('Group chat not found');
    }
    if (room.members.length >= MAX_ROOM_MEMBERS) {
      return apiBadRequest(`A group chat holds at most ${MAX_ROOM_MEMBERS} companions`);
    }
    const member = parsed.data;
    const already = room.members.some(m =>
      'assistantId' in member
        ? m.assistantId === member.assistantId
        : m.fleetSlug === member.fleetSlug
    );
    if (already) {
      return apiBadRequest('A companion can sit in a group chat once');
    }
    if ('assistantId' in member) {
      const { data } = await supabase
        .from(DATABASE_TABLES.AI_ASSISTANTS)
        .select('id')
        .eq('id', member.assistantId)
        .maybeSingle();
      if (!data) {
        return apiBadRequest('This companion is not available to you');
      }
    }
    return apiSuccess({ members: await addRoomMember(supabase, roomId, member) });
  } catch (error) {
    logger.error('room member add failed', error, 'CompanionRoomsAPI');
    return apiInternalError('Failed to add the companion');
  }
});
