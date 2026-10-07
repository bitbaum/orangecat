/**
 * "A concert today at 7pm at Rote Fabrik, 1 franc" — the words for when, read
 * in the venue's zone, for both ways the Cat makes an event. Pinned 2026-10-07
 * after that sentence produced no event: the direct action got words where it
 * wanted ISO, and the draft card's model was never told what day it was.
 */
import {
  classifyEvent,
  eventFactsFromWords,
  guessTimezone,
  normalizeEventDraft,
  parseEventWords,
  readPrice,
  readVenue,
  titleFromWords,
  withEventDayContext,
} from '@/services/cat/event-draft';
import { renderDateTime } from '@/services/ai/context-sections';
import { wallTimeToUtc } from '@/utils/timezone';

// A Wednesday, 13:10 in Zürich (11:10 UTC) — the afternoon the ask was made.
const NOW = new Date('2026-10-07T11:10:00Z');
const ZH = { now: NOW, zone: 'Europe/Zurich' };
const ctx = { now: NOW, zone: 'Europe/Zurich', currency: 'CHF' as const };

describe('parseEventWords — wall-clock in the zone', () => {
  it('today 7pm, in all the ways people say it', () => {
    for (const words of ['today at 7pm', 'today 19:00', 'tonight at 7 p.m.', 'heute 19 Uhr']) {
      expect(parseEventWords(words, ZH), words).toBe('2026-10-07T19:00');
    }
  });

  it('and the events code turns that into the right instant (CEST, +2)', () => {
    expect(wallTimeToUtc(parseEventWords('today 19:00', ZH)!, 'Europe/Zurich')).toBe(
      '2026-10-07T17:00:00.000Z'
    );
  });

  it('tomorrow, weekdays, "this" weekday', () => {
    expect(parseEventWords('tomorrow 8pm', ZH)).toBe('2026-10-08T20:00');
    // Wednesday said on a Wednesday is next week; "this Wednesday" is today.
    expect(parseEventWords('Wednesday 19:00', ZH)).toBe('2026-10-14T19:00');
    expect(parseEventWords('this Wednesday 19:00', ZH)).toBe('2026-10-07T19:00');
    expect(parseEventWords('Friday at 20:30', ZH)).toBe('2026-10-09T20:30');
  });

  it('"today" is the ZONE\'s today: 00:30 in Zürich is still yesterday in UTC', () => {
    const lateNight = { now: new Date('2026-10-07T22:30:00Z'), zone: 'Europe/Zurich' };
    expect(parseEventWords('today 19:00', lateNight)).toBe('2026-10-08T19:00');
    expect(parseEventWords('today 19:00', { ...lateNight, zone: 'UTC' })).toBe('2026-10-07T19:00');
  });

  it('passes a date through, and reads the Swiss form', () => {
    expect(parseEventWords('2026-10-07T19:00', ZH)).toBe('2026-10-07T19:00');
    expect(parseEventWords('2026-10-07T19:00:00+02:00', ZH)).toBe('2026-10-07T19:00:00+02:00');
    expect(parseEventWords('07.10.2026 19:00', ZH)).toBe('2026-10-07T19:00');
  });

  it('invents nothing: no time, or no day, is null', () => {
    expect(parseEventWords('today', ZH)).toBeNull();
    expect(parseEventWords('at Rote Fabrik', ZH)).toBeNull();
    expect(parseEventWords('', ZH)).toBeNull();
  });

  it('does not mistake "1 CHF" or a year for a time', () => {
    expect(parseEventWords('today, 1 CHF', ZH)).toBeNull();
    expect(parseEventWords('today 7pm, 1 CHF', ZH)).toBe('2026-10-07T19:00');
  });
});

describe('guessTimezone / classifyEvent', () => {
  it('names the zone from the place words', () => {
    expect(guessTimezone('Rote Fabrik, Zürich')).toBe('Europe/Zurich');
    expect(guessTimezone('Berlin')).toBe('Europe/Berlin');
    expect(guessTimezone('somewhere')).toBeNull();
  });
  it('a concert is a concert, in the Music category', () => {
    expect(classifyEvent('Concert at Rote Fabrik')).toEqual({
      event_type: 'concert',
      category: 'Music',
    });
    expect(classifyEvent('Bitcoin meetup')).toEqual({ event_type: 'meetup' });
    expect(classifyEvent('Lightning workshop')).toEqual({ event_type: 'workshop' });
  });
});

describe('normalizeEventDraft — the draft card', () => {
  it("makes the model's fields a valid event without adding facts", () => {
    const out = normalizeEventDraft(
      { title: 'Concert', start_date: 'today 7pm', location: 'Rote Fabrik, Zürich', price: 1 },
      ctx
    );
    expect(out.start_date).toBe('2026-10-07T19:00');
    expect(out.timezone).toBe('Europe/Zurich');
    expect(out.venue_name).toBe('Rote Fabrik, Zürich');
    expect(out).not.toHaveProperty('location');
    expect(out).not.toHaveProperty('price');
    expect(out.ticket_price).toBe(1);
    expect(out.is_free).toBe(false);
    expect(out.currency).toBe('CHF');
    expect(out.event_type).toBe('concert');
    expect(out.category).toBe('Music');
  });
  it('one franc is not free; a price of 0 is', () => {
    expect(normalizeEventDraft({ title: 'X', price: 0 }, ctx).is_free).toBe(true);
    expect(normalizeEventDraft({ title: 'X', ticket_price: '1 CHF' }, ctx)).toMatchObject({
      ticket_price: 1,
      is_free: false,
    });
  });
  it('leaves an unreadable date as the model wrote it, and a missing one missing', () => {
    expect(normalizeEventDraft({ title: 'X', start_date: 'soon' }, ctx).start_date).toBe('soon');
    expect(normalizeEventDraft({ title: 'X' }, ctx)).not.toHaveProperty('start_date');
  });
  it("the venue's zone beats the person's", () => {
    expect(normalizeEventDraft({ title: 'X', venue_city: 'Berlin' }, ctx).timezone).toBe(
      'Europe/Berlin'
    );
    expect(normalizeEventDraft({ title: 'X' }, ctx).timezone).toBe('Europe/Zurich');
  });
});

describe('what the models are told', () => {
  it('the draft model gets the day, in the zone, and the currency', () => {
    const text = withEventDayContext('a concert tonight', ctx);
    expect(text).toContain('today is Wednesday 2026-10-07 in Europe/Zurich');
    expect(text).toContain('prices are in CHF');
  });
  it("the Cat's context says today in the person's zone, with UTC beside it", () => {
    const late = new Date('2026-10-07T22:30:00Z');
    expect(renderDateTime('en-US', 'Europe/Zurich', late)).toContain('Thursday, October 8, 2026');
    expect(renderDateTime('en-US', 'Europe/Zurich', late)).toContain(
      '00:30 in Europe/Zurich (22:30 UTC)'
    );
    // No zone known: the UTC line it always printed.
    expect(renderDateTime('en-US', null, late)).toBe(
      '## Current Date & Time\nToday is Wednesday, October 7, 2026, 22:30 UTC.'
    );
  });
});

describe('eventFactsFromWords — the form fills from the words, model or not', () => {
  it('the sentence typed on 2026-10-07, in German', () => {
    const facts = eventFactsFromWords(
      'Konzert heute Abend in der Roten Fabrik. Beginn: 19:00 Uhr. Eintritt: 1 CHF.',
      ctx
    );
    expect(facts).toEqual({
      venue_name: 'Roten Fabrik',
      start_date: '2026-10-07T19:00',
      timezone: 'Europe/Zurich',
      ticket_price: 1,
      is_free: false,
      currency: 'CHF',
      event_type: 'concert',
      category: 'Music',
    });
  });
  it('the same in English, with the city naming the zone', () => {
    const facts = eventFactsFromWords('Concert tonight at 7pm at Rote Fabrik, Zürich, 1 CHF', {
      ...ctx,
      zone: 'UTC',
    });
    expect(facts).toMatchObject({
      venue_name: 'Rote Fabrik',
      start_date: '2026-10-07T19:00',
      timezone: 'Europe/Zurich',
      ticket_price: 1,
      currency: 'CHF',
      event_type: 'concert',
    });
  });
  it('says only what the words say: no time → no date; "free" → free', () => {
    const facts = eventFactsFromWords('Free meetup at Kraftwerk', ctx);
    expect(facts).not.toHaveProperty('start_date');
    expect(facts).toMatchObject({ venue_name: 'Kraftwerk', is_free: true, event_type: 'meetup' });
  });
  it('reads prices and venues in the ways people write them', () => {
    expect(readPrice('Eintritt: 1 CHF')).toEqual({ amount: 1, currency: 'CHF' });
    expect(readPrice('CHF 20 at the door')).toEqual({ amount: 20, currency: 'CHF' });
    expect(readPrice('€5')).toEqual({ amount: 5, currency: 'EUR' });
    expect(readPrice('12.50 Fr.')).toEqual({ amount: 12.5, currency: 'CHF' });
    expect(readPrice('starts at 7pm')).toBeNull();
    expect(readVenue('party at the Hive, Zürich')).toBe('Hive');
    expect(readVenue('im Kaufleuten um 22:00')).toBe('Kaufleuten');
    expect(readVenue('tonight at 7pm')).toBeNull();
  });
  it('a title from the words is the first clause, never invented', () => {
    expect(titleFromWords('Konzert heute Abend in der Roten Fabrik. Beginn: 19:00 Uhr.')).toBe(
      'Konzert heute Abend in der Roten Fabrik'
    );
  });
});
