/**
 * DELETE /api/calendar/linked/[id] — stop showing a linked calendar.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiInternalError,
  apiNoContent,
  apiNotFound,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getValidationError, validateUUID } from '@/lib/api/validation';
import { unlinkCalendar } from '@/services/planner/feeds';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const DELETE = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'calendar ID'));
  if (invalid) {
    return invalid;
  }
  try {
    const rl = await rateLimitWriteAsync(request.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    return (await unlinkCalendar(request.supabase, request.user.id, id))
      ? apiNoContent()
      : apiNotFound('Linked calendar not found');
  } catch (error) {
    logger.error('calendar unlink failed', error, 'LinkedCalendarsAPI');
    return apiInternalError('That calendar could not be removed');
  }
});
