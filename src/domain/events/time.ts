/**
 * An event's times, in the event's own zone.
 *
 * Writers (the form, the Cat) hand in wall-clock times as people say them —
 * "Friday 22:00" at the venue — and `resolveEventTimes` turns them into
 * instants using the venue's zone. Readers format those instants back in the
 * same zone, so a Landquart night reads 22:00 on every page, for every reader,
 * whatever zone the server runs in. All of it rests on src/utils/timezone.ts.
 */

import { STATUS } from '@/config/database-constants';
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

interface EventSpan {
  start_date?: unknown;
  end_date?: unknown;
  is_all_day?: unknown;
  timezone?: unknown;
}

/** The columns {@link eventHasEnded} reads — for a select that asks only that. */
export const EVENT_SPAN_COLUMNS = 'status, start_date, end_date, is_all_day, timezone';

const instant = (v: unknown): Date | null => {
  const d = typeof v === 'string' && v.trim() ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/**
 * The moment an event is over: its end, or its start when it has none. An
 * all-day event runs to midnight after its last day, on the venue's clock.
 * The database holds the same rule (public.event_has_ended), so a page never
 * offers a ticket the ticket functions would refuse.
 */
export function eventEndsAt(event: EventSpan): Date | null {
  const last = instant(event.end_date) ?? instant(event.start_date);
  if (!last || !event.is_all_day) {
    return last;
  }
  const zone = eventZone(event);
  const [y = 0, m = 1, d = 1] = formatInZone(
    last,
    zone,
    { year: 'numeric', month: '2-digit', day: '2-digit' },
    'en-CA'
  )
    .split('-')
    .map(Number);
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return instant(wallTimeToUtc(`${nextDay}T00:00`, zone)) ?? last;
}

/** Over: its organizer marked it completed, or {@link eventEndsAt} has passed. */
export function eventHasEnded(
  event: EventSpan & { status?: unknown },
  now: Date = new Date()
): boolean {
  if (event.status === STATUS.EVENTS.COMPLETED) {
    return true;
  }
  const end = eventEndsAt(event);
  return !!end && end.getTime() < now.getTime();
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

export { zoneLabel } from '@/utils/timezone';

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
