/**
 * The person's own calendar.
 *
 * GET  /api/calendar?days=30&zone=Europe/Zurich — the agenda: own entries,
 *      tasks and reminders that fall due, and a connected Google calendar
 * POST /api/calendar — add an entry: { title, start, end?, location?, notes?, zone? }
 *
 * `zone` is the browser's, used only when the person has not set their own
 * (Settings → bot rules): a time typed with no offset is their wall clock.
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
import { getBotSettings } from '@/services/companions/rules';
import { addCalendarEntry, readAgenda } from '@/services/planner/calendar';
import { agendaForPage } from '@/services/planner/calendar-page';
import { isValidTimeZone } from '@/utils/timezone';
import { logger } from '@/utils/logger';

const entrySchema = z.object({
  title: z.string().trim().min(1).max(200),
  start: z.string().trim().min(8).max(40),
  end: z.string().trim().max(40).optional().nullable(),
  location: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  zone: z.string().optional().nullable(),
});

/** The person's own zone when they set one, else the one their browser reports. */
async function zoneFor(request: AuthenticatedRequest, offered: string | null | undefined) {
  const own = (await getBotSettings(request.supabase, request.user.id).catch(() => null))?.timeZone;
  return own ?? (isValidTimeZone(offered) ? offered : null);
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const params = new URL((request as NextRequest).url).searchParams;
    const [agenda, zone] = await Promise.all([
      readAgenda(request.supabase, request.user.id, params.get('days') ?? 30),
      zoneFor(request, params.get('zone')),
    ]);
    return apiSuccess(agendaForPage(agenda, zone), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    logger.error('calendar load failed', error, 'CalendarAPI');
    return apiInternalError('Your calendar could not be loaded');
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const rl = await rateLimitWriteAsync(request.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const parsed = entrySchema.safeParse(await (request as NextRequest).json());
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid request data');
    }
    const { zone, ...entry } = parsed.data;
    const added = await addCalendarEntry(request.supabase, request.user.id, entry, {
      madeBy: 'me',
      zone: await zoneFor(request, zone),
    });
    return added.success
      ? apiSuccess(added.data, { status: 201 })
      : apiBadRequest(added.error ?? 'That could not be added');
  } catch (error) {
    logger.error('calendar add failed', error, 'CalendarAPI');
    return apiInternalError('That could not be added to your calendar');
  }
});
