/**
 * The event in a guest's own calendar, and the way to the door.
 */
import { directionsHref, eventIcs, googleCalendarHref } from '@/domain/events/calendar';

const base = {
  id: 'ev-1',
  title: 'Rooftop, Party; Night',
  start_date: '2026-11-21T21:00:00.000Z',
  url: 'https://orangecat.ch/events/ev-1',
};
const NOW = new Date('2026-10-07T12:00:00Z');

describe('eventIcs', () => {
  it('is one VEVENT at the event’s instant, with a stable UID and CRLF lines', () => {
    const ics = eventIcs({ ...base, end_date: '2026-11-22T03:00:00Z', place: 'Bar, Zurich' }, NOW);
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('UID:ev-1@orangecat.ch');
    expect(ics).toContain('DTSTART:20261121T210000Z');
    expect(ics).toContain('DTEND:20261122T030000Z');
    expect(ics).toContain('DTSTAMP:20261007T120000Z');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it('escapes commas and semicolons in text', () => {
    const ics = eventIcs({ ...base, place: 'Bar, Zurich' }, NOW);
    expect(ics).toContain('SUMMARY:Rooftop\\, Party\\; Night');
    expect(ics).toContain('LOCATION:Bar\\, Zurich');
  });

  it('holds three hours when the host gave no end — and never an end before the start', () => {
    expect(eventIcs(base, NOW)).toContain('DTEND:20261122T000000Z');
    expect(eventIcs({ ...base, end_date: '2026-11-21T20:00:00Z' }, NOW)).toContain(
      'DTEND:20261122T000000Z'
    );
  });

  it('puts an all-day event on the venue’s day, ending the next day', () => {
    // 23:30 UTC on the 20th is already the 21st in Zurich.
    const ics = eventIcs(
      { ...base, start_date: '2026-11-20T23:30:00Z', is_all_day: true, timezone: 'Europe/Zurich' },
      NOW
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:20261121');
    expect(ics).toContain('DTEND;VALUE=DATE:20261122');
  });

  it('folds long lines at 75 octets without splitting a character', () => {
    const ics = eventIcs({ ...base, title: 'Feier für alle Nachbarinnen ü'.repeat(6) }, NOW);
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('Feier für alle Nachbarinnen ü'.repeat(6));
  });
});

describe('googleCalendarHref', () => {
  it('carries the title, the span, the place and the link back', () => {
    const url = new URL(googleCalendarHref({ ...base, place: 'Bar, Zurich' }));
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('text')).toBe(base.title);
    expect(url.searchParams.get('dates')).toBe('20261121T210000Z/20261122T000000Z');
    expect(url.searchParams.get('location')).toBe('Bar, Zurich');
    expect(url.searchParams.get('details')).toBe(base.url);
  });
});

describe('directionsHref', () => {
  it('goes to the pin when there is one', () => {
    expect(directionsHref({ latitude: 47.37, longitude: 8.52 })).toContain('mlat=47.37&mlon=8.52');
  });

  it('searches the address when there is no pin', () => {
    expect(
      directionsHref({
        venue_name: 'Espresso Bar',
        venue_address: 'Langstrasse 1',
        venue_city: 'Zurich',
      })
    ).toContain(encodeURIComponent('Espresso Bar, Langstrasse 1, Zurich'));
  });

  it('offers nothing for a city alone — there is no door to walk to', () => {
    expect(directionsHref({ venue_city: 'Zurich' })).toBeNull();
    expect(directionsHref({ latitude: null, longitude: null })).toBeNull();
  });
});
