import { describe, expect, it } from 'vitest';
import { isTimeLocal, nextRunAt, skipReason } from '@/services/companions/routines-store';

/**
 * A bot that writes first: the next run is the next time of day in the
 * person's zone, strictly after now, and a routine runs only on the
 * person's own key.
 */
describe('nextRunAt', () => {
  it('is today when the time is still ahead, tomorrow when it has passed', () => {
    // 06:00 UTC on 2026-11-02 is 07:00 in Zürich (winter).
    const now = new Date('2026-11-02T06:00:00Z');
    expect(nextRunAt(now, '08:00', 'Europe/Zurich')).toBe('2026-11-02T07:00:00.000Z');
    expect(nextRunAt(now, '07:00', 'Europe/Zurich')).toBe('2026-11-03T06:00:00.000Z');
    expect(nextRunAt(now, '06:30', 'Europe/Zurich')).toBe('2026-11-03T05:30:00.000Z');
  });

  it('reads the time in the zone, not in UTC', () => {
    const now = new Date('2026-11-02T06:00:00Z');
    expect(nextRunAt(now, '08:00', 'America/New_York')).toBe('2026-11-02T13:00:00.000Z');
    expect(nextRunAt(now, '08:00', 'Asia/Tokyo')).toBe('2026-11-02T23:00:00.000Z');
  });

  it('is always after now', () => {
    const now = new Date('2026-03-29T00:30:00Z'); // the night Europe springs forward
    const next = new Date(nextRunAt(now, '02:30', 'Europe/Zurich')).getTime();
    expect(next).toBeGreaterThan(now.getTime());
  });
});

describe('a routine’s rules', () => {
  it('takes a time of day as HH:MM, 24 hours', () => {
    expect(isTimeLocal('08:00')).toBe(true);
    expect(isTimeLocal('23:59')).toBe(true);
    expect(isTimeLocal('24:00')).toBe(false);
    expect(isTimeLocal('8:00')).toBe(false);
    expect(isTimeLocal(800)).toBe(false);
  });

  it('runs only on the person’s own key', () => {
    expect(skipReason(true)).toBeNull();
    expect(skipReason(false)).toBe('needs_own_key');
  });
});
