/**
 * Where an event happens, when the place has a page: a bar, a studio, a hall —
 * an asset (#1237). The event names it through events.asset_id and the
 * place's page lists it under "Happening here".
 *
 * Who may name a place is the database's rule (public.can_list_events_at:
 * whoever runs it — its person, its organization's members, or the steward of
 * a place set up for someone not here yet). This module only reads.
 */

import { ENTITY_REGISTRY } from '@/config/entity-registry';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export interface Venue {
  id: string;
  title: string;
  location: string | null;
  status: string;
}

/** A place's public face, for the event page. Null when hidden or gone. */
export async function getVenue(
  supabase: AnySupabaseClient,
  assetId: string
): Promise<Venue | null> {
  const { data } = await supabase
    .from(ENTITY_REGISTRY.asset.tableName)
    .select('id, title, location, status')
    .eq('id', assetId)
    .maybeSingle();
  return (data as Venue | null) ?? null;
}

/** Places the signed-in person can list events at (the trigger's rule, as a list). */
export async function listPlacesICanListAt(supabase: AnySupabaseClient): Promise<Venue[]> {
  const { data, error } = await supabase.rpc('places_i_can_list_events_at');
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as Venue[];
}

/**
 * The place someone means by a name ("Espresso Bar"), among the places they
 * run. Exact name first; otherwise a close name, but only when exactly one
 * fits and the shorter of the two is not a fragment — a wrong place on an
 * event is worse than none.
 */
export function matchVenueByName(places: Venue[], name: string): Venue | null {
  const wanted = name.trim().toLowerCase();
  if (!wanted) {
    return null;
  }
  const exact = places.find(p => p.title.trim().toLowerCase() === wanted);
  if (exact) {
    return exact;
  }
  const close = places.filter(p => {
    const have = p.title.trim().toLowerCase();
    const shorter = have.length < wanted.length ? have : wanted;
    return shorter.length >= 5 && (have.includes(wanted) || wanted.includes(have));
  });
  return close.length === 1 ? (close[0] ?? null) : null;
}
