/**
 * GET /api/places/mine — the places (venue pages) the signed-in person can
 * list events at. The rule is the database's (places_i_can_list_events_at),
 * the same one the events trigger enforces.
 */
import { apiSuccess, apiError } from '@/lib/api/standardResponse';
import { getAuthenticatedUserId } from '@/lib/api/authHelpers';
import { createServerClient } from '@/lib/supabase/server';
import { listPlacesICanListAt } from '@/domain/events/venue-page';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return apiSuccess({ places: [] });
  }
  try {
    const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
    return apiSuccess({ places: await listPlacesICanListAt(supabase) });
  } catch (error) {
    logger.error('Could not list places', error, 'Venues');
    return apiError('Could not load your venues', 'PLACES_FAILED', 500);
  }
}
