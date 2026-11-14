import { describe, expect, it } from 'vitest';
import { readForPerson } from '@/services/connectors/pre-read';

describe('a calendar read, shown to the person when no model answers', () => {
  it('says days and times in words and drops the ids', () => {
    const text = [
      '2 in your calendar for the next 7 days (times in Europe/Zurich):',
      '- 2026-11-20 17:00 to 18:00 · haircut [entry_id: 6fc4]',
      '- 2026-12-08 (all day) · Immaculate Conception · Swiss holidays calendar',
    ].join('\n');
    expect(readForPerson(text)).toBe(
      [
        '2 in your calendar for the next 7 days:',
        '- Friday, November 20 at 5:00 PM to 6:00 PM · haircut',
        '- Tuesday, December 8 (all day) · Immaculate Conception · Swiss holidays calendar',
      ].join('\n')
    );
  });

  it('leaves an empty week as it is', () => {
    expect(readForPerson('Nothing in your calendar for the next 7 days.')).toBe(
      'Nothing in your calendar for the next 7 days.'
    );
  });
});
