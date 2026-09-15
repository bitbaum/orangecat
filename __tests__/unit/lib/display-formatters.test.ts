import { describe, it, expect } from 'vitest';
import { formatDate, formatDateLong, formatIsoDay } from '@/utils/dates';
import { formatDateTimeOrDash } from '@/utils/locale';
import {
  formatCountdownShort,
  formatCountdownCoarse,
  formatCountdownClock,
} from '@/utils/countdown';

/**
 * These formatters were each declared in three or four components under two
 * names (`formatDate`, `formatTimestamp`, `formatCountdown`). Consolidating
 * them is only safe if every screen keeps printing exactly what it printed —
 * so the strings are pinned here.
 */
describe('date formatters', () => {
  it('formatDate: the abbreviated day, for lists', () => {
    expect(formatDate('2026-07-22T10:00:00Z')).toBe('Jul 22, 2026');
  });

  it('formatDateLong: the spelled-out day, for article datelines', () => {
    expect(formatDateLong('2026-07-22T10:00:00Z')).toBe('July 22, 2026');
  });

  it('formatIsoDay: a calendar date has no timezone', () => {
    expect(formatIsoDay('2026-07-22')).toBe('Jul 22, 2026');
    expect(formatIsoDay('2026-01-05')).toBe('Jan 5, 2026');
    // The whole point: no Date is constructed, so no UTC-midnight shift can
    // render the day before west of Greenwich, or differ between server and
    // browser and trip hydration.
    expect(formatIsoDay('2026-12-31')).toBe('Dec 31, 2026');
  });
});

describe('formatDateTimeOrDash', () => {
  it('renders an em dash for an absent timestamp', () => {
    expect(formatDateTimeOrDash(null)).toBe('—');
    expect(formatDateTimeOrDash(undefined)).toBe('—');
    expect(formatDateTimeOrDash('')).toBe('—');
  });

  it('renders a real timestamp through the app locale', () => {
    expect(formatDateTimeOrDash('2026-07-22T10:00:00Z')).toContain('2026');
  });
});

describe('countdown formatters — three formats that shared one name', () => {
  it('formatCountdownShort keeps seconds near zero', () => {
    expect(formatCountdownShort(45)).toBe('45s');
    expect(formatCountdownShort(300)).toBe('5m');
    expect(formatCountdownShort(3900)).toBe('1h 5m');
    expect(formatCountdownShort(null)).toBe('—');
    expect(formatCountdownShort(-5)).toBe('0s');
  });

  it('formatCountdownCoarse never says "0m"', () => {
    expect(formatCountdownCoarse(12240)).toBe('3h 24m');
    expect(formatCountdownCoarse(2700)).toBe('45m');
    expect(formatCountdownCoarse(5)).toBe('1m');
  });

  it('formatCountdownClock is a clock face', () => {
    expect(formatCountdownClock(65)).toBe('1:05');
    expect(formatCountdownClock(600)).toBe('10:00');
    expect(formatCountdownClock(9)).toBe('0:09');
  });
});
