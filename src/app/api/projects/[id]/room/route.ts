/**
 * The investor room of a project, as its owner manages it (ADR-0012).
 *
 * GET /api/projects/[id]/room — the room, its links and recent opens
 * PUT /api/projects/[id]/room — save what the room says
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiRateLimited, apiValidationError, handleApiError } from '@/lib/api/standardResponse';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { roomContentSchema } from '@/config/project-room';
import { getOwnerRoom, saveRoomContent } from '@/domain/projectRooms/service';
import { roomResponse } from './respond';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  try {
    const { id } = await context.params;
    const invalid = getValidationError(validateUUID(id, 'project ID'));
    if (invalid) {
      return invalid;
    }
    return roomResponse(await getOwnerRoom(id, request.user.id, request.supabase));
  } catch (error) {
    return handleApiError(error);
  }
});

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
    const parsed = roomContentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiValidationError('Check the room’s fields', parsed.error.flatten());
    }
    return roomResponse(await saveRoomContent(id, request.user.id, request.supabase, parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
});
