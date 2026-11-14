/**
 * A calendar file (iCalendar, RFC 5545) read into agenda items between two
 * instants. Repeating events are expanded into the occurrences that fall in
 * the span, with their moved and cancelled occurrences applied; each time is
 * read in the zone the file names (from its own VTIMEZONE blocks).
 *
 * The parsing is ical.js (Mozilla's). No fetch here.
 *
 * Reading runs on the server's one thread, so it is bounded and polite: a
 * series that ended before the span is skipped without walking it, the whole
 * file gets a fixed number of recurrence steps, and the walk hands the thread
 * back every few milliseconds. A big calendar is read in part (and says so)
 * instead of freezing every other request — on 14 Nov 2026 one did, and
 * orangecat.ch answered nothing for about 25 minutes.
 */

import ICAL from 'ical.js';
import type { AgendaItem } from './calendar';

/** Occurrences one repeating event may contribute, so a "daily forever" cannot run away. */
const OCCURRENCES_MAX = 400;
/** Items one calendar file may contribute to one span. */
const ITEMS_MAX = 500;
/** Recurrence steps one file may take in all (each is ~25 µs of ical.js, so a few seconds at most, given back in slices). */
export const STEPS_MAX = 150_000;
/** Steps between handing the thread back to other requests (~25 ms). */
const STEPS_PER_SLICE = 1_000;
/** Events looked at between handing the thread back, for files of many short series. */
const EVENTS_PER_SLICE = 200;

/** What a file gave for a span; `complete` is false when the step budget ran out first. */
export interface CalendarRead {
  items: AgendaItem[];
  complete: boolean;
}

const yieldThread = () => new Promise<void>(resolve => setImmediate(resolve));

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

/** A repeating rule that ended (UNTIL) before the span, with no extra dates: nothing to walk. */
function endedBefore(event: ICALEvent, from: Date): boolean {
  const comp = event.component;
  if (comp.hasProperty('rdate')) {
    return false;
  }
  const rules = comp.getAllProperties('rrule').map(p => p.getFirstValue() as { until?: ICALTime });
  return (
    rules.length > 0 && rules.every(r => r.until && r.until.toJSDate().getTime() < from.getTime())
  );
}

/** An occurrence of a series with exceptions: does it (as moved) end on or after `fromMs`? */
function mayReach(event: ICALEvent, next: ICALTime, fromMs: number): boolean {
  const d = event.getOccurrenceDetails(next);
  return !d.endDate || d.endDate.toJSDate().getTime() >= fromMs;
}

/** Read a calendar file. Throws CalendarFileError when it is not one. */
export async function readCalendarFile(
  text: string,
  from: Date,
  until: Date,
  calendarName: string,
  stepsMax: number = STEPS_MAX
): Promise<CalendarRead> {
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
  let steps = 0;
  let complete = true;
  const fromMs = from.getTime();
  const untilMs = until.getTime();
  let seen = 0;
  walk: for (const event of masters.values()) {
    if (out.length >= ITEMS_MAX) {
      break;
    }
    if (++seen % EVENTS_PER_SLICE === 0) {
      await yieldThread();
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
    if (endedBefore(event, from)) {
      continue;
    }
    // How long an occurrence can run, plus two days for all-day and
    // zone-shifted ones, so one that started before the span is only looked
    // at closely when it could still reach into it. A series with moved or
    // changed occurrences (exceptions) is always looked at closely.
    const reachMs = (Math.max(event.duration?.toSeconds() ?? 0, 0) + 2 * 86_400) * 1000;
    const plain = Object.keys(event.exceptions).length === 0;
    const it = event.iterator();
    for (let n = 0; n < OCCURRENCES_MAX * 20; n++) {
      if (steps >= stepsMax) {
        complete = false;
        break walk;
      }
      if (++steps % STEPS_PER_SLICE === 0) {
        await yieldThread();
      }
      const next = it.next();
      if (!next) {
        break;
      }
      const nextMs = next.toJSDate().getTime();
      if (nextMs >= untilMs) {
        break;
      }
      // Fast-forward past occurrences that ended before the span, cheaply.
      if (plain && nextMs + reachMs < fromMs) {
        continue;
      }
      if (!plain && nextMs < fromMs && !mayReach(event, next, fromMs)) {
        continue;
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
  return { items: out, complete };
}
