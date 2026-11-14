/**
 * A calendar file (iCalendar, RFC 5545) read into agenda items between two
 * instants. Repeating events are expanded into the occurrences that fall in
 * the span, with their moved and cancelled occurrences applied; each time is
 * read in the zone the file names (from its own VTIMEZONE blocks).
 *
 * The parsing is ical.js (Mozilla's). Pure apart from it: no fetch here.
 */

import ICAL from 'ical.js';
import type { AgendaItem } from './calendar';

/** Occurrences one repeating event may contribute, so a "daily forever" cannot run away. */
const OCCURRENCES_MAX = 400;
/** Items one calendar file may contribute to one span. */
const ITEMS_MAX = 500;

type ICALTime = InstanceType<typeof ICAL.Time>;
type ICALEvent = InstanceType<typeof ICAL.Event>;

/** An all-day start stays a day ("2026-11-18"); a timed one becomes an instant. */
function startOf(time: ICALTime): string {
  return time.isDate ? time.toString().slice(0, 10) : time.toJSDate().toISOString();
}

function itemOf(
  event: ICALEvent,
  start: ICALTime,
  end: ICALTime | null,
  calendarName: string
): AgendaItem {
  return {
    source: 'linked',
    title: (event.summary || '(no title)').slice(0, 200),
    start: startOf(start),
    end: end && !end.isDate ? end.toJSDate().toISOString() : null,
    allDay: start.isDate,
    location: event.location ? String(event.location).slice(0, 300) : null,
    calendarName,
  };
}

/** Does an occurrence touch the span? All-day ones are compared by their day. */
function touches(start: ICALTime, end: ICALTime | null, from: Date, until: Date): boolean {
  const s = start.isDate
    ? Date.parse(`${start.toString().slice(0, 10)}T00:00:00Z`)
    : start.toJSDate().getTime();
  const e = end
    ? end.isDate
      ? Date.parse(`${end.toString().slice(0, 10)}T00:00:00Z`)
      : end.toJSDate().getTime()
    : s;
  return s < until.getTime() && Math.max(e, s) >= from.getTime();
}

export class CalendarFileError extends Error {}

/** Read a calendar file. Throws CalendarFileError when it is not one. */
export function readCalendarFile(
  text: string,
  from: Date,
  until: Date,
  calendarName: string
): AgendaItem[] {
  let root: InstanceType<typeof ICAL.Component>;
  try {
    root = new ICAL.Component(ICAL.parse(text));
  } catch {
    throw new CalendarFileError('This is not a calendar file.');
  }
  if (root.name !== 'vcalendar') {
    throw new CalendarFileError('This is not a calendar file.');
  }
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(tz);
    } catch {
      // A broken zone block leaves those times floating; the rest still reads.
    }
  }
  const masters = new Map<string, ICALEvent>();
  const exceptions: ICALEvent[] = [];
  for (const vevent of root.getAllSubcomponents('vevent')) {
    const event = new ICAL.Event(vevent);
    if (event.isRecurrenceException()) {
      exceptions.push(event);
    } else if (event.uid) {
      masters.set(event.uid, event);
    } else {
      masters.set(`no-uid-${masters.size}`, event);
    }
  }
  for (const ex of exceptions) {
    masters.get(ex.uid)?.relateException(ex);
  }

  const out: AgendaItem[] = [];
  const fromTime = ICAL.Time.fromJSDate(from, true);
  for (const event of masters.values()) {
    if (out.length >= ITEMS_MAX) {
      break;
    }
    const status = String(event.component.getFirstPropertyValue('status') ?? '').toUpperCase();
    if (status === 'CANCELLED' || !event.startDate) {
      continue;
    }
    if (!event.isRecurring()) {
      if (touches(event.startDate, event.endDate, from, until)) {
        out.push(itemOf(event, event.startDate, event.endDate, calendarName));
      }
      continue;
    }
    const it = event.iterator();
    for (let n = 0; n < OCCURRENCES_MAX * 20; n++) {
      const next = it.next();
      if (!next || next.toJSDate().getTime() >= until.getTime()) {
        break;
      }
      // Fast-forward past occurrences that ended before the span, cheaply.
      if (next.compare(fromTime) < 0 && !next.isDate) {
        const d = event.getOccurrenceDetails(next);
        if (d.endDate && d.endDate.toJSDate().getTime() < from.getTime()) {
          continue;
        }
      }
      const d = event.getOccurrenceDetails(next);
      const cancelled =
        String(d.item.component.getFirstPropertyValue('status') ?? '').toUpperCase() ===
        'CANCELLED';
      if (!cancelled && touches(d.startDate, d.endDate, from, until)) {
        out.push(itemOf(d.item, d.startDate, d.endDate, calendarName));
        if (out.length >= ITEMS_MAX) {
          break;
        }
      }
    }
  }
  return out;
}
