/**
 * Upcoming public events around a point, nearest first — optionally only the
 * ones playing a given genre. Visibility is the events RLS policy's decision
 * (the RPC runs as the caller), not this module's.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';

export const NEARBY_DEFAULT_RADIUS_KM = 25;
export const NEARBY_MAX_RADIUS_KM = 200;

export interface NearbyEvent {
  id: string;
  title: string;
  event_type: string | null;
  start_date: string;
  timezone: string | null;
  venue_name: string | null;
  venue_city: string | null;
  music_genres: string[];
  vibe: string | null;
  is_free: boolean | null;
  ticket_price: number | null;
  currency: string | null;
  thumbnail_url: string | null;
  distance_km: number;
}

export interface NearbyQuery {
  lat: number;
  lng: number;
  radiusKm?: number;
  genre?: string | null;
}

/** Parse the query string; null when there is no usable point. */
export function parseNearbyQuery(params: URLSearchParams): NearbyQuery | null {
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  if (
    !params.get('lat') ||
    !params.get('lng') ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return null;
  }
  const radius = Number(params.get('radius_km'));
  const genre = params.get('genre')?.trim().slice(0, 40) || null;
  return {
    lat,
    lng,
    radiusKm:
      Number.isFinite(radius) && radius > 0
        ? Math.min(radius, NEARBY_MAX_RADIUS_KM)
        : NEARBY_DEFAULT_RADIUS_KM,
    genre,
  };
}

export async function searchEventsNearby(
  supabase: AnySupabaseClient,
  q: NearbyQuery
): Promise<NearbyEvent[]> {
  const { data, error } = await supabase.rpc('search_events_nearby', {
    p_lat: q.lat,
    p_lng: q.lng,
    p_radius_km: q.radiusKm ?? NEARBY_DEFAULT_RADIUS_KM,
    p_genre: q.genre ?? null,
    p_limit: 50,
  });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as NearbyEvent[];
}
