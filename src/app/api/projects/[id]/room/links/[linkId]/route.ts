/**
 * DELETE /api/projects/[id]/room/links/[linkId] — switch a link off. The row
 * and its opens stay; only the link stops working.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiRateLimited, handleApiError } from '@/lib/api/standardResponse';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { revokeRoomLink } from '@/domain/projectRooms/service';
import { roomResponse } from '../../respond';

interface RouteContext {
  params: Promise<{ id: string; linkId: string }>;
}

export const DELETE = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  try {
    const rl = await rateLimitWriteAsync(request.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const { id, linkId } = await context.params;
    const invalid =
      getValidationError(validateUUID(id, 'project ID')) ??
      getValidationError(validateUUID(linkId, 'link ID'));
    if (invalid) {
      return invalid;
    }
    return roomResponse(await revokeRoomLink(id, linkId, request.user.id, request.supabase));
  } catch (error) {
    return handleApiError(error);
  }
});
