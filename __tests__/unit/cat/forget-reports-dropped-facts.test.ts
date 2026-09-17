/**
 * Every fact the user names is accounted for out loud.
 *
 * forget_memories quietly narrowed its own input in three different ways, and
 * none of them reached the user:
 *
 *   * the memory store took the first 10 facts and dropped the rest;
 *   * the economic-profile store applied NO cap at all, so the two stores
 *     disagreed about which facts were even in play;
 *   * facts under 4 characters were discarded as too short to match safely.
 *
 * A dropped fact and a removed fact produced the identical reply. "🧹 Removed
 * X" while fact 11 was never looked at is the same lie as finding 8's — the
 * user believes data is gone that is still there.
 *
 * Separately, the "no stored match" list filtered the caller's RAW strings
 * against the stores' NORMALISED (trimmed) answers, so a padded `" cooking "`
 * could never appear in it however plainly it missed.
 *
 * bitbaum/orangecat#563 findings 10 and 11.
 */

import { selectForgetFacts } from '@/services/cat/memory';
import { contextHandlers } from '@/services/cat/handlers/context';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/services/ai/embeddings', () => ({
  embeddingsEnabled: () => false,
  embedText: vi.fn(),
  embedTexts: vi.fn(),
}));

const MAX_FORGET_FACTS = 10;

/** Store holding exactly one memory, so a run can both remove and miss. */
function makeClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [{ id: 'm1', content: 'Loves cooking' }], error: null }),
      }),
      delete: () => ({ eq: () => ({ in: () => Promise.resolve({ error: null }) }) }),
      upsert: () => Promise.resolve({ error: null }),
      insert: () => Promise.resolve({ error: null }),
    }),
    rpc: () => Promise.resolve({ data: [], error: null }),
  } as never;
}

const forget = (facts: unknown) =>
  contextHandlers.forget_memories(makeClient(), 'user-1', 'actor-1', { facts });

describe('selectForgetFacts — one narrowing, named once', () => {
  it('trims before measuring, so padding cannot fake length', () => {
    expect(selectForgetFacts(['  ok  ']).tooShort).toEqual(['ok']);
    expect(selectForgetFacts([' cooking ']).wanted).toEqual(['cooking']);
  });

  it('separates the too-short from the wanted instead of dropping them', () => {
    const sel = selectForgetFacts(['cooking', 'js']);
    expect(sel.wanted).toEqual(['cooking']);
    expect(sel.tooShort).toEqual(['js']);
    expect(sel.overCap).toEqual([]);
  });

  it('caps at MAX_FORGET_FACTS and keeps the remainder addressable', () => {
    const facts = Array.from({ length: MAX_FORGET_FACTS + 3 }, (_, i) => `fact-${i}`);
    const sel = selectForgetFacts(facts);
    expect(sel.wanted).toHaveLength(MAX_FORGET_FACTS);
    expect(sel.overCap).toEqual(['fact-10', 'fact-11', 'fact-12']);
  });

  it('counts the cap in USABLE facts, so short ones cannot consume the budget', () => {
    // Ten shorts then one real fact: the real one must survive.
    const facts = [...Array.from({ length: 10 }, () => 'js'), 'cooking'];
    expect(selectForgetFacts(facts).wanted).toEqual(['cooking']);
  });
});

describe('forget_memories tells the user what it did not attempt', () => {
  it('names the over-cap facts rather than implying they were handled', async () => {
    const facts = ['cooking', ...Array.from({ length: MAX_FORGET_FACTS }, (_, i) => `spare-${i}`)];
    const result = await forget(facts);

    expect(result.success).toBe(true);
    const message = (result.data as { displayMessage: string }).displayMessage;
    expect(message).toContain('Removed');
    // The eleventh fact was never looked for; the reply must say so.
    expect(message).toContain('spare-9');
    expect(message).toMatch(/not yet attempted/i);
  });

  it('names the too-short facts, which are silently unmatchable otherwise', async () => {
    const result = await forget(['cooking', 'js']);
    const message = (result.data as { displayMessage: string }).displayMessage;
    expect(message).toContain('js');
    expect(message).toMatch(/too short/i);
  });

  it('reports skipped facts even when nothing at all was removed', async () => {
    const result = await forget(['js']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('js');
    expect(result.error).toMatch(/not looked for/i);
  });

  it('lists a padded fact as unmatched — raw vs normalised must not diverge', async () => {
    // The stores answer with the TRIMMED fact; comparing against the raw
    // string made this miss invisible.
    const result = await forget(['cooking', '  photography  ']);
    const message = (result.data as { displayMessage: string }).displayMessage;
    expect(message).toContain('photography');
    expect(message).toMatch(/no stored match/i);
  });

  it('says nothing extra when every fact was in play', async () => {
    const message = ((await forget(['cooking'])).data as { displayMessage: string }).displayMessage;
    expect(message).not.toMatch(/not yet attempted|too short/i);
  });
});
