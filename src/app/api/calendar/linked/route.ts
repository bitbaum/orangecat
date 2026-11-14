/**
 * Calendars kept elsewhere, linked by their private iCal address.
 *
 * GET  /api/calendar/linked — the person's linked calendars (never their addresses)
 * POST /api/calendar/linked — link one: { url, name? }; it is read once first,
 *      so a wrong link is refused with the reason
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { linkCalendar, listLinkedCalendars } from '@/services/planner/feeds';
import { logger } from '@/utils/logger';

const linkSchema = z.object({
  url: z.string().trim().min(10).max(2000),
  name: z.string().trim().max(80).optional().nullable(),
});

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    return apiSuccess(
      { calendars: await listLinkedCalendars(request.supabase, request.user.id) },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    logger.error('linked calendars load failed', error, 'LinkedCalendarsAPI');
    return apiInternalError('Your linked calendars could not be loaded');
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const rl = await rateLimitWriteAsync(request.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const parsed = linkSchema.safeParse(await (request as NextRequest).json());
    if (!parsed.success) {
      return apiBadRequest('Paste the iCal link the calendar gives you.');
    }
    const linked = await linkCalendar(request.supabase, request.user.id, parsed.data);
    return linked.ok
      ? apiSuccess({ calendar: linked.calendar, events: linked.events }, { status: 201 })
      : apiBadRequest(linked.error);
  } catch (error) {
    logger.error('calendar link failed', error, 'LinkedCalendarsAPI');
    return apiInternalError('That calendar could not be linked');
  }
});
