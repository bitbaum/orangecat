/**
 * POST /api/projects/[id]/room/links — a new link to the room, for one person
 * (or one shared door). Answers with the link, token included: the owner copies it.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiRateLimited, apiValidationError, handleApiError } from '@/lib/api/standardResponse';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { newRoomLinkSchema } from '@/config/project-room';
import { createRoomLink } from '@/domain/projectRooms/service';
import { roomResponse } from '../respond';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
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
    const parsed = newRoomLinkSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiValidationError('Say who the link is for', parsed.error.flatten());
    }
    return roomResponse(
      await createRoomLink(id, request.user.id, request.supabase, parsed.data),
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
});
