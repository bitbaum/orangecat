/**
 * An event's times, in the event's own zone.
 *
 * Writers (the form, the Cat) hand in wall-clock times as people say them —
 * "Friday 22:00" at the venue — and `resolveEventTimes` turns them into
 * instants using the venue's zone. Readers format those instants back in the
 * same zone, so a Landquart night reads 22:00 on every page, for every reader,
 * whatever zone the server runs in. All of it rests on src/utils/timezone.ts.
 */

import {
  formatInZone,
  hasUtcOffset,
  isValidTimeZone,
  timeZoneForPlace,
  wallTimeToUtc,
} from '@/utils/timezone';

/** The zone to read an event in: its own, else UTC (the column's default). */
export function eventZone(event: { timezone?: unknown }): string {
  return isValidTimeZone(event.timezone) ? event.timezone : 'UTC';
}

/** "Saturday, October 10, 2026" */
export const formatEventDay = (iso: string, zone: string) =>
  formatInZone(iso, zone, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

/** "10:00 PM" */
export const formatEventClock = (iso: string, zone: string) =>
  formatInZone(iso, zone, { hour: 'numeric', minute: '2-digit' });

/** "Sat, Oct 10, 10:00 PM" — one line, for lists. */
export const formatEventShort = (iso: string, zone: string) =>
  formatInZone(iso, zone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/** "October 8, 2026" */
export const formatEventDate = (iso: string, zone: string) =>
  formatInZone(iso, zone, { month: 'long', day: 'numeric', year: 'numeric' });

/** "10:00 PM – 2:00 AM", or one time when there is no end. */
export function formatEventClockRange(start: string, end: string | null | undefined, zone: string) {
  const from = formatEventClock(start, zone);
  return end ? `${from} – ${formatEventClock(end, zone)}` : from;
}

/** "Zurich time", "New York time", "UTC" — which clock the times are on. */
export function zoneLabel(zone: string): string {
  if (zone === 'UTC') {
    return 'UTC';
  }
  const city = zone.split('/').pop() ?? zone;
  return `${city.replace(/_/g, ' ')} time`;
}

const DATE_FIELDS = ['start_date', 'end_date', 'rsvp_deadline'] as const;

/**
 * Settle an event's zone and turn its wall-clock times into instants.
 *
 *   zone: the one asked for, unless it is the 'UTC' default and the venue's
 *         place says otherwise; else the place's zone; else UTC.
 *   times: a value without an offset is a wall-clock time in that zone; a
 *          value WITH an offset already names its instant and is kept.
 */
export function resolveEventTimes<T extends Record<string, unknown>>(
  fields: T,
  place: { countryCode?: string | null; latitude?: unknown; longitude?: unknown } = {}
): T & { timezone: string } {
  const asked = isValidTimeZone(fields.timezone) ? (fields.timezone as string) : null;
  const fromPlace = timeZoneForPlace({
    countryCode: place.countryCode ?? null,
    latitude: typeof place.latitude === 'number' ? place.latitude : Number(place.latitude ?? NaN),
    longitude:
      typeof place.longitude === 'number' ? place.longitude : Number(place.longitude ?? NaN),
  });
  const zone = asked && asked !== 'UTC' ? asked : (fromPlace ?? asked ?? 'UTC');

  const out: Record<string, unknown> = { ...fields, timezone: zone };
  for (const field of DATE_FIELDS) {
    const value = out[field];
    if (typeof value === 'string' && value.trim() && !hasUtcOffset(value)) {
      out[field] = wallTimeToUtc(value, zone) ?? value;
    }
  }
  return out as T & { timezone: string };
}
