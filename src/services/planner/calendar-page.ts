/**
 * The agenda as the calendar page draws it: grouped by day in the person's
 * own clock, each row with its time already written. The page formats
 * nothing itself, so it cannot disagree with what a bot was told.
 */

import { isValidTimeZone } from '@/utils/timezone';
import { whenText, type Agenda, type AgendaItem, type AgendaSource } from './calendar';
import { DUE_DAY_TIME } from './tasks';

export interface CalendarPageRow {
  source: AgendaSource;
  /** Present for an own entry, which the page can remove. */
  entryId?: string;
  title: string;
  /** "09:00", "09:00 to 09:30", or "All day". */
  time: string;
  location: string | null;
  /** Who wrote an own entry: 'me', 'cat', or a bot's id. */
  madeBy?: string;
  /** The name of the linked calendar it came from. */
  calendarName?: string;
  /** Minutes after midnight in the person's clock, for placing it on a time grid; null = all day. */
  startMinute: number | null;
  /** Where it ends on that grid; never past midnight, at least a quarter hour after it starts. */
  endMinute: number | null;
}

export interface CalendarPageDay {
  /** YYYY-MM-DD in the person's zone. */
  day: string;
  rows: CalendarPageRow[];
}

export interface CalendarPage {
  /** Today in the person's own clock. */
  today: string;
  days: number;
  /** The zone the times are written in; null = UTC. */
  zone: string | null;
  byDay: CalendarPageDay[];
  googleNote: string | null;
}

function rowOf(item: AgendaItem, zone: string | null): { day: string; row: CalendarPageRow } {
  const start = whenText(item.start, item.allDay, zone);
  const day = start.slice(0, 10);
  // A task due "that day" is stored at the day's last minute; it has no hour.
  const dueThatDay = item.source !== 'calendar' && start.slice(11, 16) === DUE_DAY_TIME;
  const clock =
    item.allDay || item.start.length === 10 || dueThatDay ? 'All day' : start.slice(11, 16);
  const end =
    item.end && clock !== 'All day' ? whenText(item.end, false, zone).slice(11, 16) : null;
  const minuteOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const startMinute = clock === 'All day' ? null : minuteOf(clock);
  const endDay = item.end ? whenText(item.end, false, zone).slice(0, 10) : day;
  const endMinute =
    startMinute === null
      ? null
      : Math.max(
          startMinute + 15,
          end && endDay === day ? minuteOf(end) : end ? 24 * 60 : startMinute + 30
        );
  return {
    day,
    row: {
      source: item.source,
      ...(item.source === 'calendar' && item.id ? { entryId: item.id } : {}),
      title: item.title,
      time: end && end !== clock ? `${clock} to ${end}` : clock,
      location: item.location ?? null,
      ...(item.madeBy ? { madeBy: item.madeBy } : {}),
      ...(item.calendarName ? { calendarName: item.calendarName } : {}),
      startMinute,
      endMinute: endMinute === null ? null : Math.min(endMinute, 24 * 60),
    },
  };
}

/** Pure. */
export function agendaForPage(
  agenda: Agenda,
  zone: string | null,
  now: Date = new Date()
): CalendarPage {
  const known = zone && isValidTimeZone(zone) ? zone : null;
  const byDay: CalendarPageDay[] = [];
  for (const item of agenda.items) {
    const { day, row } = rowOf(item, known);
    const last = byDay[byDay.length - 1];
    if (last?.day === day) {
      last.rows.push(row);
    } else {
      byDay.push({ day, rows: [row] });
    }
  }
  return {
    today: whenText(now.toISOString(), false, known).slice(0, 10),
    days: agenda.days,
    zone: known,
    byDay,
    googleNote: agenda.googleNote,
  };
}
