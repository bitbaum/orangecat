import { describe, expect, it } from 'vitest';
import { instantToWallTime, wallTimeToUtc } from '@/utils/timezone';
import { formatAvailabilityLines } from '@/lib/availability';

describe('instantToWallTime', () => {
  it('shows a stored instant on the event’s own clock', () => {
    // 20:00 UTC on a summer night is 22:00 in Zurich.
    expect(instantToWallTime('2026-07-09T20:00:00+00:00', 'Europe/Zurich')).toBe(
      '2026-07-09T22:00'
    );
  });

  it('round-trips with wallTimeToUtc across a zone', () => {
    const utc = wallTimeToUtc('2026-10-09T19:00', 'America/New_York')!;
    expect(instantToWallTime(utc, 'America/New_York')).toBe('2026-10-09T19:00');
  });

  it('keeps wall time as wall time', () => {
    expect(instantToWallTime('2026-10-09T19:00:00', 'Asia/Tokyo')).toBe('2026-10-09T19:00');
  });
});

describe('formatAvailabilityLines', () => {
  it('names the provider’s clock', () => {
    expect(
      formatAvailabilityLines({
        days: ['monday'],
        hours: [{ start: '09:00', end: '17:00' }],
        timezone: 'Europe/Zurich',
      })
    ).toEqual(['Mon', '09:00–17:00 (Zurich time)']);
  });
});
