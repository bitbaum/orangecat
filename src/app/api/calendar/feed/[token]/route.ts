/**
 * GET /api/calendar/feed/<secret>.ics — a person's own calendar as a file
 * Apple Calendar, Google Calendar or Outlook subscribes to.
 *
 * No sign-in: a calendar app cannot sign in. The secret in the address is
 * the key (services/planner/share.ts); an unknown or switched-off one is a
 * plain 404, the same as an address that never existed. Never cached by a
 * shared cache: the answer is one person's calendar.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { feedForToken } from '@/services/planner/share';
import { logger } from '@/utils/logger';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  try {
    const file = await feedForToken(createAdminClient(), token.replace(/\.ics$/i, ''));
    if (!file) {
      return new NextResponse('Not found', { status: 404 });
    }
    return new NextResponse(file, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="orangecat.ics"',
        'Cache-Control': 'private, max-age=300',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (error) {
    logger.error('calendar feed failed', error, 'CalendarFeed');
    return new NextResponse('Not available just now', { status: 503 });
  }
}
