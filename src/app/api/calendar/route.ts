/**
 * The person's own calendar.
 *
 * GET  /api/calendar?days=30&zone=Europe/Zurich — the coming days: own entries,
 *      tasks and reminders that fall due, and a connected Google calendar
 * GET  /api/calendar?from=2026-11-01&to=2026-12-06&zone=… — the same for a span of
 *      days, past included (a month or a week view), at most 45 days
 * POST /api/calendar — add an entry: { title, start, minutes?, end?, location?, notes?, zone? }
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
import {
  addCalendarEntry,
  daySpan,
  readAgenda,
  readAgendaBetween,
} from '@/services/planner/calendar';
import { agendaForPage } from '@/services/planner/calendar-page';
import { plannerZone } from '@/services/planner/zone';
import { logger } from '@/utils/logger';

const entrySchema = z.object({
  title: z.string().trim().min(1).max(200),
  /** A day (`YYYY-MM-DD`, all day) or a day and a wall time (`YYYY-MM-DDTHH:MM`). */
  start: z.string().trim().min(8).max(40),
  end: z.string().trim().max(40).optional().nullable(),
  /** How long, instead of an end. */
  minutes: z.number().int().min(5).max(1440).optional().nullable(),
  location: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  zone: z.string().optional().nullable(),
});

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const params = new URL((request as NextRequest).url).searchParams;
    const zone = await plannerZone(request.supabase, request.user.id, params.get('zone'));
    const from = params.get('from');
    const to = params.get('to');
    const span = from && to ? daySpan(from, to, zone) : null;
    const agenda = span
      ? await readAgendaBetween(request.supabase, request.user.id, span.from, span.until)
      : await readAgenda(request.supabase, request.user.id, params.get('days') ?? 30);
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
      zone: await plannerZone(request.supabase, request.user.id, zone),
    });
    return added.success
      ? apiSuccess(added.data, { status: 201 })
      : apiBadRequest(added.error ?? 'That could not be added');
  } catch (error) {
    logger.error('calendar add failed', error, 'CalendarAPI');
    return apiInternalError('That could not be added to your calendar');
  }
});
