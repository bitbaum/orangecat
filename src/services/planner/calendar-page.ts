/**
 * The agenda as the calendar page draws it: grouped by day in the person's
 * own clock, each row with its time already written. The page formats
 * nothing itself, so it cannot disagree with what a bot was told.
 */

import { isValidTimeZone } from '@/utils/timezone';
import { whenText, type Agenda, type AgendaItem, type AgendaSource } from './calendar';

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
}

export interface CalendarPageDay {
  /** YYYY-MM-DD in the person's zone. */
  day: string;
  rows: CalendarPageRow[];
}

export interface CalendarPage {
  days: number;
  /** The zone the times are written in; null = UTC. */
  zone: string | null;
  byDay: CalendarPageDay[];
  googleNote: string | null;
}

function rowOf(item: AgendaItem, zone: string | null): { day: string; row: CalendarPageRow } {
  const start = whenText(item.start, item.allDay, zone);
  const day = start.slice(0, 10);
  const clock = item.allDay || item.start.length === 10 ? 'All day' : start.slice(11, 16);
  const end =
    item.end && clock !== 'All day' ? whenText(item.end, false, zone).slice(11, 16) : null;
  return {
    day,
    row: {
      source: item.source,
      ...(item.source === 'calendar' && item.id ? { entryId: item.id } : {}),
      title: item.title,
      time: end && end !== clock ? `${clock} to ${end}` : clock,
      location: item.location ?? null,
      ...(item.madeBy ? { madeBy: item.madeBy } : {}),
    },
  };
}

/** Pure. */
export function agendaForPage(agenda: Agenda, zone: string | null): CalendarPage {
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
  return { days: agenda.days, zone: known, byDay, googleNote: agenda.googleNote };
}
