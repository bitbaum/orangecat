/**
 * The calendar's geometry, on plain day strings: which days a month grid
 * shows, which a week shows, and how events that overlap share a column.
 * Pure, so it is the same on the server, in the browser and in a test.
 * Weeks start on Monday, as they do where the owner lives.
 */

import { addDays, dayAnchor, weekday, type ISODate } from '@bitbaum/whenkit';
import { APP_LOCALE } from '@/utils/locale';

export type CalendarMode = 'month' | 'week' | 'list';

/** The Monday on or before a day. */
export function weekStart(day: ISODate): ISODate {
  return addDays(day, -((weekday(day) + 6) % 7));
}

/** Every day a month grid shows: whole weeks, Monday first, from the week of the 1st. */
export function monthDays(anyDayInMonth: ISODate): ISODate[] {
  const first = `${anyDayInMonth.slice(0, 7)}-01`;
  const start = weekStart(first);
  const nextMonth = addDays(first, 32).slice(0, 7);
  const days: ISODate[] = [];
  for (let d = start; days.length < 42; d = addDays(d, 1)) {
    if (days.length % 7 === 0 && days.length >= 28 && d.slice(0, 7) === nextMonth) {
      break;
    }
    days.push(d);
  }
  return days;
}

/** `count` days from `start`. */
export function daysFrom(start: ISODate, count: number): ISODate[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/** The span to load for a view of the day `anchor`, `count` days wide for a week. */
export function rangeFor(
  mode: CalendarMode,
  anchor: ISODate,
  weekWidth: number
): { from: ISODate; to: ISODate } {
  if (mode === 'month') {
    const days = monthDays(anchor);
    return { from: days[0], to: days[days.length - 1] };
  }
  if (mode === 'week') {
    const start = weekWidth === 7 ? weekStart(anchor) : anchor;
    return { from: start, to: addDays(start, weekWidth - 1) };
  }
  return { from: anchor, to: addDays(anchor, 30) };
}

/** Where the arrows go from `anchor`. */
export function step(mode: CalendarMode, anchor: ISODate, by: 1 | -1, weekWidth: number): ISODate {
  if (mode === 'month') {
    const first = `${anchor.slice(0, 7)}-01`;
    return by === 1
      ? `${addDays(first, 32).slice(0, 7)}-01`
      : `${addDays(first, -1).slice(0, 7)}-01`;
  }
  return addDays(anchor, by * (mode === 'week' ? weekWidth : 30));
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(APP_LOCALE, { ...opts, timeZone: 'UTC' });

/** "November 2026". */
export function monthTitle(day: ISODate): string {
  return fmt({ month: 'long', year: 'numeric' }).format(dayAnchor(`${day.slice(0, 7)}-01`));
}

/** "Nov 16 – 22, 2026", across months "Nov 30 – Dec 6, 2026": the locale's own range. */
export function spanTitle(from: ISODate, to: ISODate): string {
  return fmt({ day: 'numeric', month: 'short', year: 'numeric' }).formatRange(
    dayAnchor(from),
    dayAnchor(to)
  );
}

/** "9 AM", "13" — an hour as short as the locale writes it, for a grid's edge. */
export function hourLabel(hour: number): string {
  return fmt({ hour: 'numeric' }).format(new Date(Date.UTC(2026, 0, 1, hour)));
}

/** "Mon" for a day. */
export function weekdayName(day: ISODate): string {
  return fmt({ weekday: 'short' }).format(dayAnchor(day));
}

/** "Mon", "Tue" … for the grid's head, Monday first. */
export function weekdayNames(): string[] {
  const monday = '2026-11-16';
  return daysFrom(monday, 7).map(d => fmt({ weekday: 'short' }).format(dayAnchor(d)));
}

export interface Placed<T> {
  item: T;
  /** Which column of the day it sits in. */
  lane: number;
  /** How many columns the overlapping group it belongs to needs. */
  lanes: number;
}

/**
 * Side by side where they overlap, full width where they do not, the way a
 * paper diary is written. Greedy: each event takes the first column free at
 * its start. Pure.
 */
export function layoutDay<T extends { startMinute: number | null; endMinute: number | null }>(
  items: readonly T[]
): Placed<T>[] {
  const timed = items
    .filter(i => i.startMinute !== null)
    .sort((a, b) => (a.startMinute as number) - (b.startMinute as number));
  const out: Placed<T>[] = [];
  let group: Placed<T>[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const close = () => {
    const lanes = laneEnds.length;
    group.forEach(p => (p.lanes = lanes));
    out.push(...group);
    group = [];
    laneEnds = [];
  };
  for (const item of timed) {
    const start = item.startMinute as number;
    const end = Math.max(item.endMinute ?? start + 30, start + 15);
    if (start >= groupEnd && group.length > 0) {
      close();
    }
    let lane = laneEnds.findIndex(e => e <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    group.push({ item, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, end);
  }
  if (group.length > 0) {
    close();
  }
  return out;
}
