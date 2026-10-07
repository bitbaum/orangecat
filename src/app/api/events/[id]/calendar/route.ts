/**
 * GET /api/events/[id]/calendar — the event as an .ics file. Public.
 *
 * What "Add to calendar" opens on iPhones and computers, and what a guest's
 * ticket page links to. Only an event anyone may see: the same statuses the
 * event page shows, read under the visitor's own RLS.
 */
import { NextRequest } from 'next/server';
import { apiError, apiNotFound, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimit, retryAfterSeconds } from '@/lib/rate-limit';
import { createServerClient } from '@/lib/supabase/server';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { EVENT_PUBLIC_STATUSES } from '@/config/events';
import { ROUTES } from '@/config/routes';
import { SITE_URL } from '@/config/brand';
import { eventIcs } from '@/domain/events/calendar';
import { eventPlaceText } from '@/domain/events/place';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(request);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }
  const { id } = await params;
  if (!UUID.test(id)) {
    return apiNotFound('Event not found');
  }
  try {
    const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
    const { data: event } = await supabase
      .from(ENTITY_REGISTRY.event.tableName)
      .select(
        'id, title, start_date, end_date, is_all_day, timezone, venue_name, venue_address, venue_city'
      )
      .eq('id', id)
      .in('status', [...EVENT_PUBLIC_STATUSES])
      .maybeSingle();
    if (!event?.start_date) {
      return apiNotFound('Event not found');
    }
    const ics = eventIcs({
      ...event,
      place: eventPlaceText(event),
      url: `${SITE_URL}${ROUTES.EVENTS.VIEW(event.id)}`,
    });
    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="event.ics"',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    logger.error('Event calendar file failed', error, 'Events');
    return apiError('Could not build the calendar entry', 'EVENT_CALENDAR_FAILED', 500);
  }
}
