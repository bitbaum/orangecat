import { describe, expect, it } from 'vitest';
import { CalendarFileError, readCalendarFile } from '@/services/planner/ics-read';
import { escapeText, fold, writeCalendarFile } from '@/services/planner/ics-write';
import { feedHint, feedProvider, normaliseFeedUrl } from '@/services/planner/feeds';
import { isShareToken, shareLinks } from '@/services/planner/share';

const ics = (body: string) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', body, 'END:VCALENDAR'].join('\r\n');

const ZURICH = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Zurich',
  'BEGIN:STANDARD',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
].join('\r\n');

const from = new Date('2026-11-14T00:00:00Z');
const until = new Date('2026-12-14T00:00:00Z');

describe('reading a calendar from elsewhere', () => {
  it('expands a weekly meeting in its own time zone, with a moved one and a cancelled one', async () => {
    const text = ics(
      [
        ZURICH,
        'BEGIN:VEVENT',
        'UID:standup',
        'SUMMARY:Standup',
        'DTSTART;TZID=Europe/Zurich:20261102T090000',
        'DTEND;TZID=Europe/Zurich:20261102T091500',
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
        'EXDATE;TZID=Europe/Zurich:20261123T090000',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:standup',
        'RECURRENCE-ID;TZID=Europe/Zurich:20261130T090000',
        'SUMMARY:Standup (late)',
        'DTSTART;TZID=Europe/Zurich:20261130T110000',
        'DTEND;TZID=Europe/Zurich:20261130T111500',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:gone',
        'SUMMARY:Called off',
        'STATUS:CANCELLED',
        'DTSTART:20261120T100000Z',
        'END:VEVENT',
      ].join('\r\n')
    );
    const { items } = await readCalendarFile(text, from, until, 'Work');
    expect(items.map(i => [i.title, i.start])).toEqual([
      ['Standup', '2026-11-16T08:00:00.000Z'],
      ['Standup (late)', '2026-11-30T10:00:00.000Z'],
      ['Standup', '2026-12-07T08:00:00.000Z'],
    ]);
    expect(items[0]).toMatchObject({ source: 'linked', calendarName: 'Work', allDay: false });
  });

  it('keeps an all-day entry as a day', async () => {
    const { items } = await readCalendarFile(
      ics(
        [
          'BEGIN:VEVENT',
          'UID:holiday',
          'SUMMARY:Holiday',
          'DTSTART;VALUE=DATE:20261208',
          'DTEND;VALUE=DATE:20261209',
          'END:VEVENT',
        ].join('\r\n')
      ),
      from,
      until,
      'Home'
    );
    expect(items).toEqual([
      expect.objectContaining({ title: 'Holiday', start: '2026-12-08', allDay: true }),
    ]);
  });

  it('refuses a page that is not a calendar', async () => {
    await expect(readCalendarFile('<html>sign in</html>', from, until, 'x')).rejects.toThrow(
      CalendarFileError
    );
  });
});

const series = (uid: string, start: string, rule: string, end?: string) =>
  [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `SUMMARY:${uid}`,
    `DTSTART${start.length === 8 ? ';VALUE=DATE' : ''}:${start}`,
    ...(end ? [`DTEND${end.length === 8 ? ';VALUE=DATE' : ''}:${end}`] : []),
    `RRULE:${rule}`,
    'END:VEVENT',
  ].join('\r\n');

describe('a big calendar never holds the server', () => {
  it('skips a series that ended before the span without walking it', async () => {
    const text = ics(
      [
        series('old', '20000103T090000Z', 'FREQ=DAILY;UNTIL=20200101T000000Z', '20000103T100000Z'),
        'BEGIN:VEVENT\r\nUID:now\r\nSUMMARY:now\r\nDTSTART:20261120T100000Z\r\nEND:VEVENT',
      ].join('\r\n')
    );
    const read = await readCalendarFile(text, from, until, 'x', 5);
    expect(read).toMatchObject({
      complete: true,
      items: [expect.objectContaining({ title: 'now' })],
    });
  });

  it('finds the span of a series that began years ago, timed and all-day', async () => {
    const text = ics(
      [
        series('gym', '20100104T170000Z', 'FREQ=WEEKLY;BYDAY=MO', '20100104T180000Z'),
        series('pill', '20150101', 'FREQ=DAILY', '20150102'),
      ].join('\r\n')
    );
    const { items, complete } = await readCalendarFile(text, from, until, 'x');
    expect(complete).toBe(true);
    const gym = items.filter(i => i.title === 'gym').map(i => i.start);
    expect(gym[0]).toBe('2026-11-16T17:00:00.000Z');
    expect(gym).toHaveLength(4);
    const pill = items.filter(i => i.title === 'pill').map(i => i.start);
    expect(pill).toContain('2026-11-14');
    expect(pill.at(-1)).toBe('2026-12-13');
  });

  it('stops at its step budget and says it read only part', async () => {
    const text = ics(
      Array.from({ length: 20 }, (_, i) =>
        series(`m${i}`, '20000101T080000Z', 'FREQ=DAILY', '20000101T081500Z')
      ).join('\r\n')
    );
    const read = await readCalendarFile(text, from, until, 'x', 3_000);
    expect(read.complete).toBe(false);
  });

  it('hands the thread back while it reads, so other requests are answered', async () => {
    const text = ics(series('d', '20200101T080000Z', 'FREQ=DAILY', '20200101T081500Z'));
    let done = false;
    let doneWhenOthersRan: boolean | null = null;
    const reading = readCalendarFile(text, from, until, 'x').then(() => {
      done = true;
    });
    setImmediate(() => {
      doneWhenOthersRan = done;
    });
    await reading;
    expect(doneWhenOthersRan).toBe(false);
  });
});

describe('writing the OrangeCat calendar as a file', () => {
  it('escapes text and folds long lines at 75 octets without splitting a character', () => {
    expect(escapeText('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne');
    const long = `SUMMARY:${'ä'.repeat(60)}`;
    const folded = fold(long);
    for (const line of folded.split('\r\n')) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });

  it('writes timed and all-day entries a calendar app reads back', async () => {
    const file = writeCalendarFile('George', [
      {
        uid: 'a1',
        title: 'Dentist, Dr. Ries',
        start: '2026-11-16T08:00:00.000Z',
        end: '2026-11-16T09:00:00.000Z',
        allDay: false,
        location: null,
        notes: null,
        updatedAt: '2026-11-14T10:00:00.000Z',
      },
      {
        uid: 'b2',
        title: 'Trip',
        start: '2026-12-08',
        end: null,
        allDay: true,
        location: null,
        notes: null,
        updatedAt: '2026-11-14T10:00:00.000Z',
      },
    ]);
    expect(file).toContain('UID:a1@orangecat.ch');
    expect(file).toContain('DTSTART:20261116T080000Z');
    expect(file).toContain('SUMMARY:Dentist\\, Dr. Ries');
    expect(file).toContain('DTSTART;VALUE=DATE:20261208');
    expect(file).toContain('DTEND;VALUE=DATE:20261209');
    const { items: back } = await readCalendarFile(file, from, until, 'George');
    expect(back.map(i => i.title)).toEqual(['Dentist, Dr. Ries', 'Trip']);
  });
});

describe('a calendar link as people paste it', () => {
  it('reads webcal as https and refuses what is not a web address', () => {
    expect(normaliseFeedUrl(' webcal://p01-caldav.icloud.com/published/2/abc ')).toBe(
      'https://p01-caldav.icloud.com/published/2/abc'
    );
    expect(normaliseFeedUrl('ftp://x.example/cal.ics')).toBeNull();
    expect(normaliseFeedUrl('my calendar')).toBeNull();
  });

  it('knows the provider from the host, not from a look-alike', () => {
    expect(feedProvider('https://calendar.google.com/calendar/ical/x/private-y/basic.ics')).toBe(
      'google'
    );
    expect(feedProvider('https://p01-caldav.icloud.com/published/2/abc')).toBe('apple');
    expect(feedProvider('https://outlook.office365.com/owa/calendar/x/calendar.ics')).toBe(
      'outlook'
    );
    expect(feedProvider('https://evilicloud.com/cal.ics')).toBe('other');
  });

  it('shows a hint, never the secret part', () => {
    expect(
      feedHint('https://calendar.google.com/calendar/ical/x/private-secret1234/basic.ics')
    ).toBe('calendar.google.com/…1234');
  });
});

describe('the private subscribe link', () => {
  it('is offered as https and webcal', () => {
    const token = 'a'.repeat(43);
    const links = shareLinks(token, 'https://orangecat.ch');
    expect(links.https).toBe(`https://orangecat.ch/api/calendar/feed/${token}.ics`);
    expect(links.webcal).toBe(`webcal://orangecat.ch/api/calendar/feed/${token}.ics`);
  });

  it('only takes a long random token', () => {
    expect(isShareToken('A'.repeat(43))).toBe(true);
    expect(isShareToken('short')).toBe(false);
    expect(isShareToken('../../etc/passwd'.padEnd(43, 'x'))).toBe(false);
  });
});
