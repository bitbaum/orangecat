/**
 * Group chats between a person and their companions.
 *
 * GET  /api/ai-assistants/rooms — the person's rooms, newest activity first
 * POST /api/ai-assistants/rooms — open one: { title?, members: [{ assistantId } | { fleetSlug }] }
 */

import type { NextRequest } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiCreated,
  apiInternalError,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { newRoomSchema } from '@/lib/api/companion-rooms';
import { DATABASE_TABLES } from '@/config/database-tables';
import { createRoom, listRooms } from '@/services/companions/rooms/store';
import { logger } from '@/utils/logger';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    return apiSuccess(await listRooms(request.supabase));
  } catch (error) {
    logger.error('rooms list failed', error, 'CompanionRoomsAPI');
    return apiInternalError('Failed to load group chats');
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const parsed = newRoomSchema.safeParse(await (request as NextRequest).json());
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid request data');
    }
    const members = parsed.data.members;
    const assistantIds = members.flatMap(m => ('assistantId' in m ? [m.assistantId] : []));
    const fleetSlugs = members.flatMap(m => ('fleetSlug' in m ? [m.fleetSlug] : []));
    if (
      new Set(assistantIds).size !== assistantIds.length ||
      new Set(fleetSlugs).size !== fleetSlugs.length
    ) {
      return apiBadRequest('A companion can sit in a group chat once');
    }
    // Only companions the person may talk to — their own, or public and active
    // — can be seated; RLS answers that question on the read.
    if (assistantIds.length > 0) {
      const { data } = await supabase
        .from(DATABASE_TABLES.AI_ASSISTANTS)
        .select('id')
        .in('id', assistantIds);
      const seen = new Set(((data ?? []) as { id: string }[]).map(r => r.id));
      if (assistantIds.some(id => !seen.has(id))) {
        return apiBadRequest('One of these companions is not available to you');
      }
    }
    const room = await createRoom(supabase, user.id, {
      title: parsed.data.title,
      members,
    });
    return apiCreated(room);
  } catch (error) {
    logger.error('room create failed', error, 'CompanionRoomsAPI');
    return apiInternalError('Failed to open the group chat');
  }
});
