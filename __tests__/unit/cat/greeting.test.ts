import { describe, expect, it } from 'vitest';
import { greetingFor, todayLine } from '@/components/ai-chat/ModernChatPanel/components/EmptyState';

/** The Cat greets a person by name, never by the handle the platform minted. */
describe('greetingFor', () => {
  const evening = new Date(2026, 10, 1, 19, 0);

  it('uses the first name when there is one', () => {
    expect(greetingFor(evening, 'Ana Müller')).toBe('Good evening, Ana');
  });

  it('says nothing after the greeting for a minted handle (seen live: "user_2fc1cf52eceb")', () => {
    expect(greetingFor(evening, 'user_2fc1cf52eceb')).toBe('Good evening');
    expect(greetingFor(evening, null)).toBe('Good evening');
  });

  it('keeps a handle the person chose', () => {
    expect(greetingFor(evening, 'cato')).toBe('Good evening, cato');
  });
});

/** Under the greeting: what today is, in the reader's own date order. */
describe('todayLine', () => {
  it('names the weekday, the date and the time', () => {
    expect(todayLine(new Date(2026, 10, 12, 6, 5), 'en-GB')).toBe('Thursday 12 November · 06:05');
  });
});
