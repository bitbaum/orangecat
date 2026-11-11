import { describe, expect, it } from 'vitest';
import {
  COMPANION_HONESTY,
  COMPANION_SHELF,
  jobDefinition,
  ownedShelfBot,
  shelfDefinition,
  shelfEntry,
  starterDefinition,
  starterGreeting,
} from '@/config/companions';
import { CAT_TARGET, sameTarget, targetFromParams } from '@/components/companions/talk/types';

/**
 * The shelf: bots that come with a job, so nobody has to define one before
 * it is useful. Found on the live site (2026-10-31): a bot made from a blank
 * name asked "what should I help you with?" after the person had already
 * said, because its greeting was a model call that lost the race.
 */
describe('the shelf', () => {
  it('holds five bots with unique ids, a row-sized job and a first line that fits', () => {
    expect(COMPANION_SHELF.length).toBe(5);
    expect(new Set(COMPANION_SHELF.map(e => e.id)).size).toBe(COMPANION_SHELF.length);
    for (const e of COMPANION_SHELF) {
      expect(e.job.length).toBeLessThanOrEqual(60);
      expect(e.job.charAt(0)).toBe(e.job.charAt(0).toLowerCase());
      expect(e.firstLine.length).toBeLessThanOrEqual(500);
      expect(e.definition.length).toBeGreaterThan(80);
    }
  });

  it('finds an entry by id and nothing for a stranger', () => {
    expect(shelfEntry('pitch-coach')?.name).toBe('Pitch Coach');
    expect(shelfEntry('nope')).toBeUndefined();
    expect(shelfEntry(undefined)).toBeUndefined();
  });

  it('writes a definition with the job and the honesty rule, and no question to ask', () => {
    const text = shelfDefinition(COMPANION_SHELF[0]);
    expect(text).toContain(COMPANION_SHELF[0].definition);
    expect(text).toContain(COMPANION_HONESTY);
    expect(text).not.toContain('What should I help you with');
  });
});

describe('a blank bot', () => {
  it('greets at creation, without a model', () => {
    expect(starterGreeting('Funes')).toBe(
      'Hi, I’m Funes. I’m ready as soon as you tell me what you need me for.'
    );
  });

  it('adopts a job stated in the first message instead of asking again', () => {
    const text = starterDefinition('Funes');
    expect(text).toContain('do not ask again');
    expect(text).toContain(COMPANION_HONESTY);
    expect(jobDefinition('Funes', 'coach pitches')).toContain(COMPANION_HONESTY);
  });
});

describe('the Cat in the list', () => {
  it('opens on with=cat and is the same target every time', () => {
    const target = targetFromParams(new URLSearchParams(`with=${CAT_TARGET}`));
    expect(target).toEqual({ kind: 'cat' });
    expect(sameTarget(target, { kind: 'cat' })).toBe(true);
    expect(sameTarget(target, { kind: 'fleet', slug: 'cat' })).toBe(false);
  });
});

describe('a shelf entry you already have', () => {
  const entry = COMPANION_SHELF.find(e => e.id === 'writing-partner')!;
  const row = (over: Partial<{ mine: boolean; title: string; description: string | null }>) => ({
    id: 'x',
    mine: true,
    title: entry.name,
    description: entry.job,
    ...over,
  });

  it('opens yours instead of making a second (two "Writing Partner" rows, seen live)', () => {
    expect(ownedShelfBot(entry, [row({})])?.id).toBe('x');
  });

  it('is not someone else’s, and not one you renamed or gave another job', () => {
    expect(ownedShelfBot(entry, [row({ mine: false })])).toBeUndefined();
    expect(ownedShelfBot(entry, [row({ title: 'My writer' })])).toBeUndefined();
    expect(ownedShelfBot(entry, [row({ description: 'drafts tweets' })])).toBeUndefined();
    expect(ownedShelfBot(entry, [])).toBeUndefined();
  });
});
