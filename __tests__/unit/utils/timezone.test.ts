import {
  formatInZone,
  hasUtcOffset,
  isValidTimeZone,
  timeZoneForPlace,
  wallTimeToUtc,
  zoneOffsetMinutes,
} from '@/utils/timezone';

describe('wallTimeToUtc — a wall-clock time at a place, as an instant', () => {
  it('reads 22:00 in Zurich as 20:00 UTC in summer time and 21:00 UTC in winter', () => {
    expect(wallTimeToUtc('2026-10-09T22:00', 'Europe/Zurich')).toBe('2026-10-09T20:00:00.000Z');
    expect(wallTimeToUtc('2026-12-11T22:00', 'Europe/Zurich')).toBe('2026-12-11T21:00:00.000Z');
  });

  it('gets the night the clocks change right', () => {
    // Zurich leaves summer time at 03:00 on 25 Oct 2026; 23:00 the evening
    // before is still UTC+2, 23:00 that evening is UTC+1.
    expect(wallTimeToUtc('2026-10-24T23:00', 'Europe/Zurich')).toBe('2026-10-24T21:00:00.000Z');
    expect(wallTimeToUtc('2026-10-25T23:00', 'Europe/Zurich')).toBe('2026-10-25T22:00:00.000Z');
  });

  it('keeps a value that already names its instant, and refuses nonsense', () => {
    expect(wallTimeToUtc('2026-10-09T22:00:00+02:00', 'America/New_York')).toBe(
      '2026-10-09T20:00:00.000Z'
    );
    expect(wallTimeToUtc('2026-10-09T20:00:00Z', 'Asia/Tokyo')).toBe('2026-10-09T20:00:00.000Z');
    expect(wallTimeToUtc('next friday', 'Europe/Zurich')).toBeNull();
  });

  it('reads a date alone as midnight there', () => {
    expect(wallTimeToUtc('2026-10-09', 'Asia/Tokyo')).toBe('2026-10-08T15:00:00.000Z');
  });
});

describe('timeZoneForPlace', () => {
  it.each([
    [{ countryCode: 'CH' }, 'Europe/Zurich'],
    [{ countryCode: 'de' }, 'Europe/Berlin'],
    [{ countryCode: 'US', latitude: 40.7, longitude: -74 }, 'America/New_York'],
    [{ countryCode: 'US', latitude: 34, longitude: -118.2 }, 'America/Los_Angeles'],
    [{ countryCode: 'US', latitude: 61.2, longitude: -149.9 }, 'America/Anchorage'],
    [{ countryCode: 'US', latitude: 21.3, longitude: -157.9 }, 'Pacific/Honolulu'],
    [{ countryCode: 'AU', latitude: -31.9, longitude: 115.9 }, 'Australia/Perth'],
    [{ countryCode: 'BR', latitude: -23.5, longitude: -46.6 }, 'America/Sao_Paulo'],
  ])('%o → %s', (place, zone) => {
    expect(timeZoneForPlace(place)).toBe(zone);
  });

  it('says it does not know rather than guess', () => {
    expect(timeZoneForPlace({ countryCode: 'US' })).toBeNull();
    expect(timeZoneForPlace({ countryCode: 'XX' })).toBeNull();
    expect(timeZoneForPlace({})).toBeNull();
  });
});

describe('helpers', () => {
  it('knows real zones from made-up ones', () => {
    expect(isValidTimeZone('Europe/Zurich')).toBe(true);
    expect(isValidTimeZone('CET+1')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('spots an offset', () => {
    expect(hasUtcOffset('2026-10-09T22:00Z')).toBe(true);
    expect(hasUtcOffset('2026-10-09T22:00+0200')).toBe(true);
    expect(hasUtcOffset('2026-10-09T22:00')).toBe(false);
  });

  it('measures and formats in the zone, not the machine', () => {
    expect(zoneOffsetMinutes(new Date('2026-07-01T12:00:00Z'), 'Europe/Zurich')).toBe(120);
    expect(
      formatInZone('2026-10-09T20:00:00Z', 'Europe/Zurich', { hour: 'numeric', minute: '2-digit' })
    ).toBe('10:00 PM');
  });
});
