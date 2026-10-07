/**
 * Weekly availability for bookable entities (services).
 *
 * Mirrors the existing `availability_schedule` jsonb shape — the
 * AvailabilitySchedule interface in domain/commerce/service.ts and the Zod in
 * lib/validation/commerce.ts: a set of available `days` + one or more `hours`
 * ranges that apply to those days. This module is the shared client-side type +
 * display/parse helpers so the editor and public display agree on the shape.
 */

import { DAYS_OF_WEEK, type DayOfWeek } from '@/config/schedule';
import { isValidTimeZone, zoneLabel } from '@/utils/timezone';

export interface AvailabilityHours {
  start: string; // "HH:MM" 24h
  end: string; // "HH:MM" 24h
}

export interface AvailabilitySchedule {
  days?: DayOfWeek[];
  hours?: AvailabilityHours[];
  timezone?: string;
}

/** Day metadata in week order, with short labels for compact display. */
export const WEEKDAYS: Array<{ key: DayOfWeek; label: string; short: string }> = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
];

const DAY_ORDER: Record<DayOfWeek, number> = WEEKDAYS.reduce(
  (acc, d, i) => {
    acc[d.key] = i;
    return acc;
  },
  {} as Record<DayOfWeek, number>
);

/** Narrow unknown jsonb into a clean AvailabilitySchedule (defensive). */
export function parseAvailability(value: unknown): AvailabilitySchedule {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const v = value as { days?: unknown; hours?: unknown; timezone?: unknown };
  const days = Array.isArray(v.days)
    ? (v.days.filter(d => (DAYS_OF_WEEK as readonly string[]).includes(d as string)) as DayOfWeek[])
    : undefined;
  const hours = Array.isArray(v.hours)
    ? (v.hours.filter(
        (h): h is AvailabilityHours =>
          !!h &&
          typeof h === 'object' &&
          typeof (h as AvailabilityHours).start === 'string' &&
          typeof (h as AvailabilityHours).end === 'string'
      ) as AvailabilityHours[])
    : undefined;
  return {
    ...(days && days.length ? { days } : {}),
    ...(hours && hours.length ? { hours } : {}),
    ...(typeof v.timezone === 'string' ? { timezone: v.timezone } : {}),
  };
}

/** True when there's at least one day AND one hour range to show. */
export function hasAvailability(value: unknown): boolean {
  const a = parseAvailability(value);
  return !!a.days?.length && !!a.hours?.length;
}

const shortOf = (d: DayOfWeek) => WEEKDAYS.find(w => w.key === d)?.short ?? d;

/**
 * Compact human-readable summary, e.g.:
 *   { days: ['monday','tuesday','wednesday','thursday','friday'], hours:[{09:00–17:00}] }
 *   → ["Mon–Fri", "09:00–17:00"]
 * Consecutive days collapse into a range; otherwise they're comma-joined.
 */
export function formatAvailabilityLines(value: unknown): string[] {
  const { days, hours, timezone } = parseAvailability(value);
  if (!days?.length || !hours?.length) {
    return [];
  }
  const sorted = [...days].sort((a, b) => DAY_ORDER[a] - DAY_ORDER[b]);

  // Collapse consecutive days into ranges.
  const groups: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && DAY_ORDER[sorted[j + 1]] === DAY_ORDER[sorted[j]] + 1) {
      j++;
    }
    groups.push(i === j ? shortOf(sorted[i]) : `${shortOf(sorted[i])}–${shortOf(sorted[j])}`);
    i = j + 1;
  }

  const daysLine = groups.join(', ');
  // Name the clock: the provider's hours, not the reader's.
  const clock = isValidTimeZone(timezone) ? ` (${zoneLabel(timezone)})` : '';
  const hoursLine = hours.map(h => `${h.start}–${h.end}`).join(', ') + clock;
  return [daysLine, hoursLine];
}
