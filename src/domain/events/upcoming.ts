/**
 * Upcoming public events with no point to measure from: what /events lists
 * before a visitor shares a location or types a place. It used to list
 * nothing until then, so the one public event on Discover, and every online
 * event, never showed.
 *
 * Same filters as search_events_nearby (live statuses, not a test row), the
 * same genre match, and over by the one rule every page and the ticket
 * functions share (eventHasEnded). Online events first, then by date.
 * Visibility is still the events RLS policy's decision (caller's client).
 */

import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { NearbyEvent } from './nearby';
import { EVENT_SPAN_COLUMNS, eventHasEnded } from './time';

export type UpcomingEvent = Omit<NearbyEvent, 'distance_km'> & {
  distance_km: null;
  is_online: boolean;
};

const UPCOMING_LIMIT = 50;

/** The statuses the ticket functions open on: a listed event can take a ticket. */
const LISTED_STATUSES = [
  STATUS.EVENTS.PUBLISHED,
  STATUS.EVENTS.OPEN,
  STATUS.EVENTS.FULL,
  STATUS.EVENTS.ONGOING,
];

const COLUMNS = `id, title, event_type, start_date, timezone, venue_name, venue_city, music_genres, vibe, is_free, ticket_price, currency, thumbnail_url, is_online, ${EVENT_SPAN_COLUMNS}`;

export async function listUpcomingEvents(
  supabase: AnySupabaseClient,
  opts: { genre?: string | null; now?: Date } = {}
): Promise<UpcomingEvent[]> {
  const now = opts.now ?? new Date();
  // A generous cut in the query (a day back); the exact "is it over" is
  // eventHasEnded below, which knows all-day events and the venue's zone.
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  let query = supabase
    .from(ENTITY_REGISTRY.event.tableName)
    .select(COLUMNS)
    .in('status', LISTED_STATUSES)
    .eq('is_test', false)
    .or(`end_date.gte.${since},and(end_date.is.null,start_date.gte.${since})`);
  if (opts.genre) {
    query = query.contains('music_genres', [opts.genre]);
  }
  const { data, error } = await query
    .order('is_online', { ascending: false })
    .order('start_date', { ascending: true })
    .limit(UPCOMING_LIMIT);
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter(row => !eventHasEnded(row, now))
    .map(row => ({
      id: row.id as string,
      title: row.title as string,
      event_type: (row.event_type as string | null) ?? null,
      start_date: row.start_date as string,
      timezone: (row.timezone as string | null) ?? null,
      venue_name: (row.venue_name as string | null) ?? null,
      venue_city: (row.venue_city as string | null) ?? null,
      music_genres: (row.music_genres as string[] | null) ?? [],
      vibe: (row.vibe as string | null) ?? null,
      is_free: (row.is_free as boolean | null) ?? null,
      ticket_price: (row.ticket_price as number | null) ?? null,
      currency: (row.currency as string | null) ?? null,
      thumbnail_url: (row.thumbnail_url as string | null) ?? null,
      is_online: row.is_online === true,
      distance_km: null,
    }));
}
