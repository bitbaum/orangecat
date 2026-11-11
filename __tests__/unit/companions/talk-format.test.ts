import { describe, it, expect } from 'vitest';
import { matchesQuery, nameWithJob, whenLabel } from '@/components/companions/talk/format';
import { previewOf } from '@/services/companions/talk-home';
import { targetFromParams, sameTarget } from '@/components/companions/talk/types';

describe('the talk list’s small words', () => {
  const now = new Date('2026-10-30T12:00:00Z');

  it('says a time today, a weekday this week, a date before that', () => {
    expect(whenLabel('2026-10-30T08:05:00Z', now)).toMatch(/08[:.]05/);
    expect(whenLabel('2026-10-28T08:05:00Z', now)).toBe('Wednesday');
    expect(whenLabel('2026-10-22T08:05:00Z', now)).toMatch(/22/);
    expect(whenLabel('2025-10-22T08:05:00Z', now)).toMatch(/2025/);
    expect(whenLabel(null, now)).toBe('');
    expect(whenLabel('garbage', now)).toBe('');
  });

  it('joins a name and its job with a middle dot, and keeps the job short', () => {
    expect(nameWithJob('Funes', 'Remembers everything')).toBe('Funes · Remembers everything');
    expect(nameWithJob('Funes', '   ')).toBe('Funes');
    expect(nameWithJob('Funes', 'x'.repeat(60))).toHaveLength('Funes · '.length + 40);
  });

  it('matches what was typed, accents and case aside', () => {
    expect(matchesQuery('Zoë Müller · keeps the books', 'zoe mull')).toBe(true);
    expect(matchesQuery('Funes', 'lex')).toBe(false);
    expect(matchesQuery('anything', '  ')).toBe(true);
  });

  it('previews one breath of the last line, bookkeeping removed', () => {
    expect(previewOf('Hello\n\nthere   friend')).toBe('Hello there friend');
    expect(previewOf('x'.repeat(200))).toHaveLength(140);
    expect(previewOf('', 'user')).toBeNull();
    expect(previewOf('Method log | noted\nSure thing', 'assistant')).toBe('Sure thing');
  });

  it('reads a target from the address', () => {
    expect(targetFromParams(new URLSearchParams('with=abc'))).toEqual({
      kind: 'companion',
      id: 'abc',
    });
    expect(targetFromParams(new URLSearchParams('with=fleet:causius'))).toEqual({
      kind: 'fleet',
      slug: 'causius',
    });
    expect(targetFromParams(new URLSearchParams('room=r1&with=abc'))).toEqual({
      kind: 'room',
      id: 'r1',
    });
    expect(targetFromParams(new URLSearchParams(''))).toBeNull();
    expect(targetFromParams(null)).toBeNull();
    expect(sameTarget({ kind: 'fleet', slug: 'a' }, { kind: 'fleet', slug: 'a' })).toBe(true);
    expect(sameTarget({ kind: 'room', id: 'a' }, { kind: 'companion', id: 'a' })).toBe(false);
    expect(sameTarget(null, null)).toBe(true);
  });
});
