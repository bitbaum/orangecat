import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatTime,
  formatIsoDay,
  formatRelativeTimeFine,
  formatRelativeTimeCompact,
} from '@/utils/dates';

/**
 * These formatters gained a `DateFormat` argument so a person's chosen date
 * format reaches the half of the app that renders through date-fns rather than
 * `toLocaleDateString`. Two things have to stay true:
 *
 *  1. The DEFAULT is byte-for-byte what it rendered before, so every caller not
 *     yet given the viewer's format is untouched rather than silently restyled.
 *  2. `formatIsoDay` keeps its timezone guarantee. It exists because
 *     `new Date('2026-07-22')` is UTC midnight, which renders the previous day
 *     west of Greenwich and differs between server and browser — a hydration
 *     mismatch. It now formats through date-fns, so that guarantee is worth
 *     re-pinning rather than assuming.
 */

const JULY_22 = '2026-07-22';

describe('the default is exactly what these rendered before', () => {
  it('formatDate still writes the month first', () => {
    expect(formatDate(new Date(2026, 6, 22))).toBe('Jul 22, 2026');
  });

  it('formatIsoDay still writes "Jul 22, 2026"', () => {
    expect(formatIsoDay(JULY_22)).toBe('Jul 22, 2026');
  });

  it('formatTime still uses a 12-hour clock', () => {
    expect(formatTime(new Date(2026, 6, 22, 14, 5))).toBe('2:05 PM');
  });
});

describe('a chosen format reaches the date-fns half of the app', () => {
  it('writes the day first when asked', () => {
    expect(formatDate(new Date(2026, 6, 22), 'day-first')).toBe('22 Jul 2026');
    expect(formatIsoDay(JULY_22, 'day-first')).toBe('22 Jul 2026');
  });

  it('writes ISO when asked', () => {
    expect(formatDate(new Date(2026, 6, 22), 'iso')).toBe('2026-07-22');
    expect(formatIsoDay(JULY_22, 'iso')).toBe('2026-07-22');
  });

  it('switches the clock to 24 hours outside the month-first world', () => {
    const at = new Date(2026, 6, 22, 14, 5);
    expect(formatTime(at, 'day-first')).toBe('14:05');
    expect(formatTime(at, 'iso')).toBe('14:05');
  });
});

describe('formatIsoDay still reads calendar digits, not an instant', () => {
  /**
   * The bug this guards: `new Date('2026-01-01')` is UTC midnight, so anywhere
   * west of Greenwich it is still 2025-12-31 locally. A date with no time in it
   * has no timezone, and this formatter is the one that acts like it.
   */
  it('never slips to the previous day, even on a year boundary', () => {
    expect(formatIsoDay('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatIsoDay('2026-01-01', 'iso')).toBe('2026-01-01');
  });

  it('agrees with the plain string it was given, for every month', () => {
    for (let month = 1; month <= 12; month++) {
      const iso = `2026-${String(month).padStart(2, '0')}-01`;
      expect(formatIsoDay(iso, 'iso'), `${iso} must round-trip`).toBe(iso);
    }
  });
});

describe('the relative formatters hand their format to the fallback', () => {
  const longAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);

  it('formatRelativeTimeFine falls back in the chosen format', () => {
    expect(formatRelativeTimeFine(longAgo, 'iso')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formatRelativeTimeCompact falls back in the chosen format', () => {
    expect(formatRelativeTimeCompact(longAgo, 'iso')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('still says "just now" and "Today" regardless of format', () => {
    expect(formatRelativeTimeFine(new Date(), 'iso')).toBe('just now');
    expect(formatRelativeTimeCompact(new Date(), 'iso')).toBe('Today');
  });
});
