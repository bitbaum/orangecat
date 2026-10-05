/**
 * Put an event on the map.
 *
 * Events store a structured venue (name, street, city, postcode, country) and
 * a latitude/longitude pair that nothing used to fill — so no event could be
 * found by place. This fills the pin from whatever address text exists, and
 * never throws: an event without a pin is still an event.
 */

import { geocodeAddress, type GeocodedVenue } from '@/lib/nominatim';

type VenueFields = {
  venue_name?: unknown;
  venue_address?: unknown;
  venue_city?: unknown;
  venue_postal_code?: unknown;
  venue_country?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  is_online?: unknown;
};

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** The address as one geocodable line, or null if there is nothing to look up. */
export function venueQuery(fields: VenueFields): string | null {
  const street = text(fields.venue_address);
  const cityLine = [fields.venue_postal_code, fields.venue_city]
    .map(text)
    .filter(Boolean)
    .join(' ');
  const country = text(fields.venue_country);
  if (!street && !cityLine && !country) {
    // A venue name alone ("Hive") is ambiguous worldwide — no pin beats a wrong one.
    return null;
  }
  // Without a street the name is what narrows a city down to a place.
  const name = street ? null : text(fields.venue_name);
  return [name, street, cityLine || null, country].filter(Boolean).join(', ');
}

const coord = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') {
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// numeric columns can arrive as strings; a pin is two finite coordinates.
const hasPin = (f: VenueFields) => coord(f.latitude) !== null && coord(f.longitude) !== null;

/**
 * Return the fields with latitude/longitude filled when they were missing and
 * the address resolves. Structured fields the person typed always win over the
 * geocoder's reading of them; it only fills blanks.
 */
export async function withVenuePin<T extends VenueFields>(
  fields: T,
  geocode: (q: string) => Promise<GeocodedVenue | null> = geocodeAddress
): Promise<T> {
  if (fields.is_online === true || hasPin(fields)) {
    return fields;
  }
  const query = venueQuery(fields);
  if (!query) {
    return fields;
  }
  const hit = await geocode(query);
  if (!hit) {
    return fields;
  }
  return {
    ...fields,
    latitude: hit.latitude,
    longitude: hit.longitude,
    venue_city: text(fields.venue_city) ?? hit.venue_city,
    venue_postal_code: text(fields.venue_postal_code) ?? hit.venue_postal_code,
    venue_country: text(fields.venue_country) ?? hit.venue_country,
  };
}

const VENUE_TEXT_FIELDS = [
  'venue_name',
  'venue_address',
  'venue_city',
  'venue_postal_code',
  'venue_country',
] as const;

/**
 * The pin for an edited event. The edit form sends back whatever pin it
 * loaded, so a changed address would otherwise keep pointing at the old place.
 * Re-geocodes when the address moved (or the event never had a pin); keeps
 * the pin when only other fields changed; clears it when nothing resolves,
 * because no pin beats a wrong one.
 */
export async function repinIfMoved<T extends VenueFields>(
  update: T,
  existing: VenueFields,
  geocode: (q: string) => Promise<GeocodedVenue | null> = geocodeAddress
): Promise<T> {
  const moved = VENUE_TEXT_FIELDS.some(f => f in update && text(update[f]) !== text(existing[f]));
  if (!moved && hasPin(existing)) {
    return hasPin(update)
      ? update
      : { ...update, latitude: coord(existing.latitude), longitude: coord(existing.longitude) };
  }
  const merged = { ...existing, ...update, latitude: null, longitude: null };
  const pinned = await withVenuePin(merged, geocode);
  return { ...update, latitude: pinned.latitude, longitude: pinned.longitude };
}

/**
 * From one free-text location ("Langstrasse 120, Zürich" or "Hive Club,
 * Zürich") build the venue fields. Used by the Cat, which hears a sentence,
 * not a form.
 */
export async function venueFromText(
  location: string,
  geocode: (q: string) => Promise<GeocodedVenue | null> = geocodeAddress
): Promise<Required<Omit<VenueFields, 'is_online'>>> {
  const raw = location.trim();
  const hit = raw ? await geocode(raw) : null;
  if (!hit) {
    // Keep what was said, verbatim, so the page still tells people where to go.
    return {
      venue_name: null,
      venue_address: raw || null,
      venue_city: null,
      venue_postal_code: null,
      venue_country: null,
      latitude: null,
      longitude: null,
    };
  }
  return {
    venue_name: hit.venue_name,
    venue_address: hit.venue_address ?? raw,
    venue_city: hit.venue_city,
    venue_postal_code: hit.venue_postal_code,
    venue_country: hit.venue_country,
    latitude: hit.latitude,
    longitude: hit.longitude,
  };
}

/** A group's place, as the groups table stores it. */
export interface GroupPlace {
  name?: string | null;
  street_address?: string | null;
  postal_code?: string | null;
  locality?: string | null;
  country_code?: string | null;
}

/**
 * The map pin for an organization's door (a bar, a hall). Null when it has no
 * street address — a group known only by its locality gets no pin, because a
 * town's centre is not anyone's front door.
 */
export async function pinForGroupPlace(
  place: GroupPlace,
  geocode: (q: string) => Promise<GeocodedVenue | null> = geocodeAddress
): Promise<{ latitude: number | null; longitude: number | null }> {
  if (!text(place.street_address)) {
    return { latitude: null, longitude: null };
  }
  const pinned = await withVenuePin(
    {
      venue_name: place.name,
      venue_address: place.street_address,
      venue_postal_code: place.postal_code,
      venue_city: place.locality,
      venue_country: place.country_code,
      latitude: null,
      longitude: null,
    },
    geocode
  );
  return { latitude: coord(pinned.latitude), longitude: coord(pinned.longitude) };
}
