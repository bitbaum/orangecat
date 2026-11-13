/**
 * GET /api/events/nearby?lat=&lng=&radius_km=&genre=
 * Upcoming public events around a point, nearest first. Public.
 * Without a point (no lat and no lng): every upcoming public event, online
 * first, then by date, so /events lists something before anyone shares a
 * location.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimit, retryAfterSeconds } from '@/lib/rate-limit';
import { createServerClient } from '@/lib/supabase/server';
import { parseNearbyQuery, searchEventsNearby } from '@/domain/events/nearby';
import { listUpcomingEvents } from '@/domain/events/upcoming';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';

export async function GET(request: NextRequest) {
  const rl = await rateLimit(request);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }
  const params = new URL(request.url).searchParams;
  if (!params.has('lat') && !params.has('lng')) {
    try {
      const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
      const genre = params.get('genre')?.trim().slice(0, 40) || null;
      return apiSuccess({ events: await listUpcomingEvents(supabase, { genre }), query: null });
    } catch (error) {
      logger.error('Upcoming events list failed', error, 'Events');
      return apiError('Could not list upcoming events', 'EVENTS_UPCOMING_FAILED', 500);
    }
  }
  const query = parseNearbyQuery(params);
  if (!query) {
    return apiError('lat and lng are required', 'VALIDATION', 400);
  }
  try {
    const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
    return apiSuccess({ events: await searchEventsNearby(supabase, query), query });
  } catch (error) {
    logger.error('Nearby events search failed', error, 'Events');
    return apiError('Could not search nearby events', 'EVENTS_NEARBY_FAILED', 500);
  }
}
