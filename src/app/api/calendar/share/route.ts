/**
 * Your OrangeCat calendar in your phone's calendar.
 *
 * GET    /api/calendar/share — the links, or null when it is off
 * POST   /api/calendar/share — turn it on, or make a new link (the old one stops)
 * DELETE /api/calendar/share — turn it off
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiInternalError,
  apiNoContent,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { makeShare, readShare, stopShare } from '@/services/planner/share';
import { logger } from '@/utils/logger';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    return apiSuccess(
      { links: await readShare(request.supabase, request.user.id) },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    logger.error('calendar share load failed', error, 'CalendarShareAPI');
    return apiInternalError('Your calendar link could not be loaded');
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const rl = await rateLimitWriteAsync(request.user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }
  const links = await makeShare(request.supabase, request.user.id).catch(() => null);
  return links
    ? apiSuccess({ links }, { status: 201 })
    : apiInternalError('Your calendar link could not be made');
});

export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  const rl = await rateLimitWriteAsync(request.user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }
  await stopShare(request.supabase, request.user.id);
  return apiNoContent();
});
