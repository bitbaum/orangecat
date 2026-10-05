/**
 * The link between an event and the organization whose place it is at — a
 * bar's page. Reads only; who may make the link is the events trigger's rule
 * (members of the venue), and which events are public is the events RLS.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { EVENT_PUBLIC_STATUSES } from '@/config/events';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export interface VenueGroup {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  street_address: string | null;
  postal_code: string | null;
  locality: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

const VENUE_SELECT =
  'id, name, slug, avatar_url, street_address, postal_code, locality, country_code, latitude, longitude';

export interface VenueEvent {
  id: string;
  title: string;
  start_date: string;
  music_genres: string[] | null;
  is_free: boolean | null;
  ticket_price: number | null;
  currency: string | null;
  status: string;
}

export async function getVenueGroup(
  supabase: AnySupabaseClient,
  groupId: string
): Promise<VenueGroup | null> {
  const { data } = await supabase
    .from(DATABASE_TABLES.GROUPS)
    .select(VENUE_SELECT)
    .eq('id', groupId)
    .maybeSingle();
  return (data as VenueGroup | null) ?? null;
}

/** Upcoming public events at a venue, soonest first. */
export async function listUpcomingAtVenue(
  supabase: AnySupabaseClient,
  groupId: string,
  limit = 20
): Promise<VenueEvent[]> {
  const sinceMidnight = new Date();
  sinceMidnight.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from(ENTITY_REGISTRY.event.tableName)
    .select('id, title, start_date, music_genres, is_free, ticket_price, currency, status')
    .eq('venue_group_id', groupId)
    .in(
      'status',
      [...EVENT_PUBLIC_STATUSES].filter(s => s !== 'completed')
    )
    .gte('start_date', sinceMidnight.toISOString())
    .order('start_date', { ascending: true })
    .limit(limit);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as VenueEvent[];
}

/**
 * The venue the signed-in person means by a name ("Espresso Bar") — among the
 * organizations they are a member of, since only members may list events
 * there. Exact name first, then a name that contains what was said.
 */
export async function findMyVenueByName(
  supabase: AnySupabaseClient,
  userId: string,
  name: string
): Promise<VenueGroup | null> {
  const wanted = name.trim().toLowerCase();
  if (!wanted) {
    return null;
  }
  const { data } = await supabase
    .from(DATABASE_TABLES.GROUP_MEMBERS)
    .select(`group:groups(${VENUE_SELECT})`)
    .eq('user_id', userId);
  const mine = ((data ?? []) as Array<{ group: VenueGroup | VenueGroup[] | null }>)
    .flatMap(row => (Array.isArray(row.group) ? row.group : row.group ? [row.group] : []))
    .filter(g => g?.name);
  const exact = mine.find(g => g.name.trim().toLowerCase() === wanted);
  if (exact) {
    return exact;
  }
  // "Espresso" for "Espresso Bar Landquart" — but only when exactly one of
  // their organizations fits, and never on a fragment too short to mean much:
  // a wrong venue on an event is worse than none.
  const close = mine.filter(g => {
    const have = g.name.trim().toLowerCase();
    const shorter = have.length < wanted.length ? have : wanted;
    return shorter.length >= 5 && (have.includes(wanted) || wanted.includes(have));
  });
  return close.length === 1 ? close[0] : null;
}

/** "Bahnhofstrasse 5, 7302 Landquart" — the venue's door as one line. */
export function venueAddressLine(
  v: Pick<VenueGroup, 'street_address' | 'postal_code' | 'locality'>
) {
  const cityLine = [v.postal_code, v.locality].filter(Boolean).join(' ');
  return [v.street_address, cityLine].filter(Boolean).join(', ') || null;
}
