/**
 * DELETE /api/calendar/[id] — take one of your own entries out of your calendar.
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
import { removeCalendarEntry } from '@/services/planner/calendar';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const DELETE = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'entry ID'));
  if (invalid) {
    return invalid;
  }
  try {
    const rl = await rateLimitWriteAsync(request.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const removed = await removeCalendarEntry(request.supabase, request.user.id, { entry_id: id });
    return removed.success ? apiNoContent() : apiNotFound('Calendar entry not found');
  } catch (error) {
    logger.error('calendar remove failed', error, 'CalendarAPI');
    return apiInternalError('That could not be removed');
  }
});
