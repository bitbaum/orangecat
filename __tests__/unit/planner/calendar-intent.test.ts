import { describe, expect, it } from 'vitest';
import { calendarWriteIntent, entryParams } from '@/services/planner/calendar-intent';

/** 2026-11-14 is a Saturday. */
const today = '2026-11-14';
const ask = (m: string) => calendarWriteIntent(m, today);

describe('an instruction to put something in the calendar', () => {
  it('is heard when it names the calendar and says when', () => {
    expect(ask('Put dentist on Monday at 9 in my calendar')).toMatchObject({
      title: 'dentist',
      day: '2026-11-16',
      time: '09:00',
    });
    expect(ask('add lunch with Ana tomorrow 12:30 to my calendar')).toMatchObject({
      title: 'lunch with Ana',
      day: '2026-11-15',
      time: '12:30',
    });
    expect(ask('Calendar: Flight to Berlin 2026-12-03 7am')).toMatchObject({
      title: 'Flight to Berlin',
      day: '2026-12-03',
      time: '07:00',
    });
    expect(
      ask('Can you schedule a call with the accountant Friday 3pm for 30 min in my calendar?')
    ).toMatchObject({
      title: 'a call with the accountant',
      day: '2026-11-20',
      time: '15:00',
      minutes: 30,
    });
  });

  it('is heard in German', () => {
    expect(ask('Trag Zahnarzt am Montag um 9 Uhr in meinen Kalender ein')).toMatchObject({
      title: 'Zahnarzt',
      day: '2026-11-16',
      time: '09:00',
    });
  });

  it('puts a time with no day said on today', () => {
    expect(ask('put yoga at 6pm in my calendar')).toMatchObject({ day: today, time: '18:00' });
  });

  it('is not heard when the calendar is not named, or nothing says when', () => {
    expect(ask('Put dentist on Monday at 9')).toBeNull();
    expect(ask('what is in my calendar tomorrow')).toBeNull();
    expect(ask('add the dentist to my calendar')).toBeNull();
    expect(ask('How do I use my calendar?')).toBeNull();
  });

  it('becomes what the calendar’s write takes', () => {
    expect(entryParams(ask('Put dentist Monday 9am at Chur in my calendar')!)).toEqual({
      title: 'dentist',
      start: '2026-11-16T09:00',
      minutes: 60,
      location: 'Chur',
    });
    expect(entryParams(ask('add holiday on 18.11. to my calendar')!)).toEqual({
      title: 'holiday',
      start: '2026-11-18',
    });
  });
});
