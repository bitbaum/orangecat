/**
 * GET /api/events/nearby?lat=&lng=&radius_km=&genre=
 * Upcoming public events around a point, nearest first. Public.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimit, retryAfterSeconds } from '@/lib/rate-limit';
import { createServerClient } from '@/lib/supabase/server';
import { parseNearbyQuery, searchEventsNearby } from '@/domain/events/nearby';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';

export async function GET(request: NextRequest) {
  const rl = await rateLimit(request);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }
  const query = parseNearbyQuery(new URL(request.url).searchParams);
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
