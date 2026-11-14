import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from '@/services/planner/quick-add';

/**
 * One line, typed or dictated, becomes an entry: nobody fills in a date
 * field. 2026-11-14 is a Saturday.
 */
const today = '2026-11-14';
const read = (line: string) => parseQuickAdd(line, today);

describe('one line into an entry', () => {
  it('reads what, when, how long and where', () => {
    expect(read('Dentist Monday 9am for 30 min at Chur')).toEqual({
      title: 'Dentist',
      day: '2026-11-16',
      time: '09:00',
      minutes: 30,
      place: 'Chur',
    });
  });

  it('reads the days people say', () => {
    expect(read('Call Ana tomorrow').day).toBe('2026-11-15');
    expect(read('Call Ana today').day).toBe('2026-11-14');
    expect(read('Tax form next week').day).toBe('2026-11-21');
    expect(read('Gym Friday').day).toBe('2026-11-20');
    // The day itself, said on that day, means a week from now.
    expect(read('Market Saturday').day).toBe('2026-11-21');
    expect(read('Lunch 16.11.').day).toBe('2026-11-16');
    expect(read('Lunch 16 Nov').day).toBe('2026-11-16');
    expect(read('Lunch Nov 16').day).toBe('2026-11-16');
    expect(read('Trip 2027-01-03').day).toBe('2027-01-03');
    // A date already past this year is next year's.
    expect(read('Birthday 3.2.').day).toBe('2027-02-03');
  });

  it('reads the times people say', () => {
    expect(read('Standup at 9').time).toBe('09:00');
    expect(read('Standup 9:30').time).toBe('09:30');
    expect(read('Dinner 7pm').time).toBe('19:00');
    expect(read('Dinner 7 pm').time).toBe('19:00');
    expect(read('Flight 14.45').time).toBe('14:45');
    expect(read('Lunch noon').time).toBe('12:00');
    expect(read('Night bus 12am').time).toBe('00:00');
  });

  it('reads how long', () => {
    expect(read('Workshop for 2 hours').minutes).toBe(120);
    expect(read('Call 45 min').minutes).toBe(45);
    expect(read('Review 1.5h').minutes).toBe(90);
  });

  it('reads German the same way', () => {
    expect(read('Zahnarzt Montag um 9 Uhr für 30 Minuten in Chur')).toEqual({
      title: 'Zahnarzt',
      day: '2026-11-16',
      time: '09:00',
      minutes: 30,
      place: 'Chur',
    });
    expect(read('Steuererklärung morgen').day).toBe('2026-11-15');
    expect(read('Erinnere mich an Miete übermorgen')).toMatchObject({
      title: 'Miete',
      day: '2026-11-16',
    });
  });

  it('drops the way of asking, and keeps the thing', () => {
    expect(read('remind me to call the landlord tomorrow').title).toBe('call the landlord');
    expect(read('add buy a present for Ana').title).toBe('buy a present for Ana');
    expect(read('Put dentist on Monday at 9').title).toBe('dentist');
  });

  it('leaves alone what it does not recognise', () => {
    expect(read('Read chapter 3')).toEqual({
      title: 'Read chapter 3',
      day: null,
      time: null,
      minutes: null,
      place: null,
    });
    // A number that is not a time or a date stays in the title.
    expect(read('Buy 2 tickets').title).toBe('Buy 2 tickets');
    // A place needs a capital; "in time" is not one.
    expect(read('Finish report in time').place).toBeNull();
    expect(read('').title).toBe('');
  });

  it('does not mistake a month word for a weekday, or a weekday inside a word', () => {
    expect(read('Monthly review').day).toBeNull();
    expect(read('Sunset walk').day).toBeNull();
    expect(read('Do the laundry').day).toBeNull();
  });
});
