/**
 * A person's own calendar as an iCalendar file (RFC 5545), for Apple
 * Calendar, Google Calendar or Outlook to subscribe to. Written by hand, not
 * by a library: it is one VEVENT per entry, and every line is escaped and
 * folded at 75 octets as the standard asks. Pure.
 */

export interface FeedEvent {
  uid: string;
  title: string;
  /** An instant, or `YYYY-MM-DD` for an all-day entry. */
  start: string;
  end: string | null;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  updatedAt: string;
}

/** TEXT values: backslash, semicolon, comma and line breaks escaped. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Lines longer than 75 octets continue on the next line after one space. */
export function fold(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) {
    return line;
  }
  const parts: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Never cut a multi-byte character in half.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end--;
    }
    parts.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
    limit = 74;
  }
  return parts.join('\r\n ');
}

/** 2026-11-16T08:00:00.000Z → 20261116T080000Z */
const stamp = (iso: string) =>
  iso
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
    .slice(0, 15) + 'Z';
/** 2026-11-18 → 20261118 */
const dayStamp = (day: string) => day.slice(0, 10).replace(/-/g, '');
/** The day after, for an all-day entry's exclusive end. */
const nextDay = (day: string) =>
  new Date(Date.parse(`${day.slice(0, 10)}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

export function writeCalendarFile(name: string, events: readonly FeedEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OrangeCat//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    // Ask subscribers to look again every half hour.
    'REFRESH-INTERVAL;VALUE=DURATION:PT30M',
    'X-PUBLISHED-TTL:PT30M',
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@orangecat.ch`, `DTSTAMP:${stamp(e.updatedAt)}`);
    if (e.allDay) {
      const day = e.start.slice(0, 10);
      lines.push(
        `DTSTART;VALUE=DATE:${dayStamp(day)}`,
        `DTEND;VALUE=DATE:${dayStamp(nextDay(day))}`
      );
    } else {
      lines.push(`DTSTART:${stamp(e.start)}`);
      lines.push(
        `DTEND:${stamp(e.end ?? new Date(Date.parse(e.start) + 3_600_000).toISOString())}`
      );
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.location) {
      lines.push(`LOCATION:${escapeText(e.location)}`);
    }
    if (e.notes) {
      lines.push(`DESCRIPTION:${escapeText(e.notes)}`);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
