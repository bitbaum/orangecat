import {
  eventEndsAt,
  eventHasEnded,
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

// The same rule as public.event_has_ended (migration 20261113163700): a page
// must never offer a ticket the ticket functions refuse, nor hide one they take.
describe('when an event is over', () => {
  const now = new Date('2026-11-12T12:00:00Z');

  it('is over once its start has passed, when it has no end', () => {
    // The live case: Sunday, September 13, 2026, still offering a free ticket.
    expect(eventHasEnded({ status: 'published', start_date: '2026-09-13T21:08:47Z' }, now)).toBe(
      true
    );
    expect(eventHasEnded({ start_date: '2026-11-14T20:00:00Z' }, now)).toBe(false);
  });

  it('runs to its end when it has one', () => {
    const tonight = { start_date: '2026-11-12T10:00:00Z', end_date: '2026-11-12T23:00:00Z' };
    expect(eventHasEnded(tonight, now)).toBe(false);
    expect(eventHasEnded(tonight, new Date('2026-11-12T23:00:01Z'))).toBe(true);
    expect(eventEndsAt(tonight)?.toISOString()).toBe('2026-11-12T23:00:00.000Z');
  });

  it('runs an all-day event to midnight after its last day, on the venue’s clock', () => {
    // 00:00 in Zurich on the 12th is 23:00 UTC on the 11th.
    const day = {
      start_date: '2026-11-11T23:00:00Z',
      is_all_day: true,
      timezone: 'Europe/Zurich',
    };
    expect(eventEndsAt(day)?.toISOString()).toBe('2026-11-12T23:00:00.000Z');
    expect(eventHasEnded(day, now)).toBe(false);
    expect(eventHasEnded({ ...day, is_all_day: false }, now)).toBe(true);
    expect(
      eventEndsAt({ ...day, end_date: '2026-11-13T23:00:00Z' })?.toISOString() // through the 14th
    ).toBe('2026-11-14T23:00:00.000Z');
  });

  it('reads an all-day event with no usable zone in UTC, as the pages do', () => {
    expect(
      eventEndsAt({ start_date: '2026-11-11T23:00:00Z', is_all_day: true, timezone: 'nowhere' })
    ).toEqual(new Date('2026-11-12T00:00:00Z'));
  });

  it('is over when its organizer marked it completed, whatever the date', () => {
    expect(eventHasEnded({ status: 'completed', start_date: '2026-12-01T20:00:00Z' }, now)).toBe(
      true
    );
  });

  it('is not over when it has no date to be over by', () => {
    expect(eventHasEnded({ status: 'published' }, now)).toBe(false);
    expect(eventHasEnded({ start_date: 'not a date' }, now)).toBe(false);
  });
});
