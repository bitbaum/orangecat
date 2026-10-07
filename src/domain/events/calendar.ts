/**
 * An event in the guest's own calendar, and the way to the door.
 *
 * The two things a guest most often loses between saying yes and the night
 * itself are the date and the place. Both are answered here once, for the
 * event page, the "your ticket" card and the guest's ticket page alike.
 *
 * Pure: no I/O, so the calendar route and the pages share it and it is tested
 * on its own.
 */

import { formatInZone } from '@/utils/timezone';

export interface CalendarEventInput {
  id: string;
  title: string;
  start_date: string;
  end_date?: string | null;
  is_all_day?: boolean | null;
  timezone?: string | null;
  /** One line naming the place, when there is one. */
  place?: string | null;
  /** The event page, absolute. */
  url: string;
}

/**
 * A calendar entry needs an end. When the host gave none, hold three hours —
 * a block in the guest's own calendar, not a claim about the event, and the
 * event page they can open from it says what is actually known.
 */
const DEFAULT_LENGTH_MS = 3 * 60 * 60 * 1000;

function endOf(e: CalendarEventInput): Date {
  const start = new Date(e.start_date);
  const end = e.end_date ? new Date(e.end_date) : null;
  return end && end.getTime() > start.getTime()
    ? end
    : new Date(start.getTime() + DEFAULT_LENGTH_MS);
}

/** 20261121T210000Z — the UTC form both ICS and Google take. */
const utcStamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** 20261121 — the day as the venue's clock reads it (all-day events). */
function zoneDay(d: Date, zone: string): string {
  const parts = formatInZone(
    d,
    zone,
    { year: 'numeric', month: '2-digit', day: '2-digit' },
    'en-CA'
  );
  return parts.replace(/-/g, '');
}

function nextDay(day: string): string {
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8) + 1));
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function span(e: CalendarEventInput): { start: string; end: string; allDay: boolean } {
  const start = new Date(e.start_date);
  if (e.is_all_day) {
    const zone = e.timezone || 'UTC';
    const first = zoneDay(start, zone);
    const last = e.end_date ? zoneDay(new Date(e.end_date), zone) : first;
    return { start: first, end: nextDay(last < first ? first : last), allDay: true };
  }
  return { start: utcStamp(start), end: utcStamp(endOf(e)), allDay: false };
}

/** RFC 5545 TEXT escaping. */
const icsText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** RFC 5545 folds lines longer than 75 octets; a continuation starts with a space. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 74;
    // Never split a multi-byte character: back off until the head fits.
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 74) {
      cut--;
    }
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

/** A one-event .ics file every calendar app opens. */
export function eventIcs(e: CalendarEventInput, now: Date = new Date()): string {
  const { start, end, allDay } = span(e);
  const when = allDay
    ? [`DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`]
    : [`DTSTART:${start}`, `DTEND:${end}`];
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OrangeCat//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@orangecat.ch`,
    `DTSTAMP:${utcStamp(now)}`,
    ...when,
    `SUMMARY:${icsText(e.title)}`,
    ...(e.place ? [`LOCATION:${icsText(e.place)}`] : []),
    `DESCRIPTION:${icsText(e.url)}`,
    `URL:${e.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

/**
 * Google Calendar's own "add" page. Android has no app that opens a
 * downloaded .ics reliably, but every Android phone has Google Calendar.
 */
export function googleCalendarHref(e: CalendarEventInput): string {
  const { start, end } = span(e);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${start}/${end}`,
    details: e.url,
    ...(e.place ? { location: e.place } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * The way there: the pin when the event has one, otherwise a search for the
 * address. Null when there is nothing to find — an event "in Zurich" has no
 * door to walk to, and a map of the whole city helps nobody.
 */
export function directionsHref(place: {
  latitude?: unknown;
  longitude?: unknown;
  venue_name?: unknown;
  venue_address?: unknown;
  venue_city?: unknown;
}): string | null {
  const lat = Number(place.latitude ?? NaN);
  const lon = Number(place.longitude ?? NaN);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
  }
  const address = typeof place.venue_address === 'string' ? place.venue_address.trim() : '';
  if (!address) {
    return null;
  }
  const query = [place.venue_name, address, place.venue_city]
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .join(', ');
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}
