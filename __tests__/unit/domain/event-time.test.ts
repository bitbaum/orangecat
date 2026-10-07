import {
  eventZone,
  formatEventClockRange,
  formatEventDay,
  resolveEventTimes,
  zoneLabel,
} from '@/domain/events/time';

describe('resolveEventTimes — what the form and the Cat send', () => {
  it('reads wall-clock times in the zone of the place', () => {
    const out = resolveEventTimes(
      { start_date: '2026-10-09T22:00', end_date: '2026-10-10T03:00', timezone: 'UTC' },
      { countryCode: 'CH', latitude: 46.96, longitude: 9.55 }
    );
    expect(out).toMatchObject({
      timezone: 'Europe/Zurich',
      start_date: '2026-10-09T20:00:00.000Z',
      end_date: '2026-10-10T01:00:00.000Z',
    });
  });

  it('keeps a zone the organizer chose over the place', () => {
    expect(
      resolveEventTimes(
        { start_date: '2026-10-09T22:00', timezone: 'Europe/London' },
        { countryCode: 'CH' }
      )
    ).toMatchObject({ timezone: 'Europe/London', start_date: '2026-10-09T21:00:00.000Z' });
  });

  it('leaves times that carry an offset, and falls back to UTC when nothing is known', () => {
    expect(resolveEventTimes({ start_date: '2026-10-09T22:00:00+02:00' })).toMatchObject({
      timezone: 'UTC',
      start_date: '2026-10-09T22:00:00+02:00',
    });
    expect(resolveEventTimes({ start_date: '2026-10-09T22:00' }).start_date).toBe(
      '2026-10-09T22:00:00.000Z'
    );
  });
});

describe('reading an event', () => {
  const event = {
    start_date: '2026-10-09T20:00:00Z',
    end_date: '2026-10-10T01:00:00Z',
    timezone: 'Europe/Zurich',
  };

  it('shows the venue’s clock, whatever the server keeps', () => {
    expect(formatEventDay(event.start_date, eventZone(event))).toBe('Friday, October 9, 2026');
    expect(formatEventClockRange(event.start_date, event.end_date, eventZone(event))).toBe(
      '10:00 PM – 3:00 AM'
    );
    expect(zoneLabel(eventZone(event))).toBe('Zurich time');
  });

  it('reads an event with no usable zone in UTC', () => {
    expect(eventZone({ timezone: 'nonsense' })).toBe('UTC');
    expect(zoneLabel('UTC')).toBe('UTC');
    expect(zoneLabel('America/New_York')).toBe('New York time');
  });
});
