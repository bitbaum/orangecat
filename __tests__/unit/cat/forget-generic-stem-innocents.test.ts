/**
 * Innocent memories that merely SHARE A STEM with the target must survive.
 *
 * INCIDENT_CORPUS was built from one real over-deletion, so every row in it is
 * either a target or obviously unrelated. That shape flatters the matcher: the
 * dangerous case is a memory that shares a common stem with the forget phrase
 * and is nonetheless a different fact — "cooking skills" beside "photography
 * skills", "documentary work" beside "weekend work".
 *
 * bitbaum/orangecat#563 suggestion 17: the corpus lacked these, so nothing
 * proved the word-boundary fix (#831 / finding 9) held against them.
 */

import { forgetMemoriesMatching } from '@/services/cat/memory';
import type { AnySupabaseClient } from '@/lib/supabase/types';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/services/ai/embeddings', () => ({
  embeddingsEnabled: () => false,
  embedText: vi.fn(),
  embedTexts: vi.fn(),
}));

interface Row {
  id: string;
  content: string;
}

function clientFor(corpus: Row[]) {
  return {
    from: () => ({
      select: () => ({ eq: async () => ({ data: corpus, error: null }) }),
      delete: () => ({ eq: () => ({ in: async () => ({ error: null }) }) }),
      insert: async () => ({ error: null }),
      upsert: async () => ({ error: null }),
    }),
    rpc: async () => ({ data: [], error: null }),
  } as unknown as AnySupabaseClient;
}

/** Targets plus innocents that share a stem with each target. */
const CORPUS: Row[] = [
  { id: 'a1', content: 'Has photography skills from years of freelance work' },
  { id: 'a2', content: 'Has strong cooking skills' },
  { id: 'a3', content: 'Can only work on weekends.' },
  { id: 'a4', content: 'Has a documentary photography background' },
  { id: 'a5', content: 'Prefers Lightning over on-chain payments' },
  { id: 'a6', content: 'Owns a drone.' },
];

const forget = (facts: string[]) => forgetMemoriesMatching(clientFor(CORPUS), 'u1', facts);

describe('forget leaves stem-sharing innocents alone', () => {
  it('"cooking skills" does not take the photography skills with it', async () => {
    const result = await forget(['cooking skills']);
    expect(result.deleted).toEqual(['Has strong cooking skills']);
  });

  it('"photography skills" does not take the cooking skills with it', async () => {
    const result = await forget(['photography skills']);
    expect(result.deleted).not.toContain('Has strong cooking skills');
    // Both photography rows are legitimately about photography.
    for (const kept of result.deleted) {
      expect(kept.toLowerCase()).toContain('photograph');
    }
  });

  /**
   * Single-word containment is DELIBERATE — memory-forget.test.ts:138 pins it
   * as how a user removes a whole topic ("forget photography" clears every
   * photography memory). The consequence, pinned here so it is a decision and
   * not a surprise: a generic word like "skills" is treated as a topic too, so
   * it clears every memory phrased with it, across unrelated subjects.
   *
   * That is the accepted cost of topic removal, and #838 makes it visible —
   * the reply names each memory it deleted, so an over-broad word is caught by
   * the user reading the receipt rather than discovered later.
   */
  it('treats a generic word as a topic, clearing every memory phrased with it', async () => {
    const result = await forget(['skills']);
    expect(result.deleted).toEqual([
      'Has photography skills from years of freelance work',
      'Has strong cooking skills',
    ]);
  });

  it('"weekend work" does not reach "freelance work"', async () => {
    const result = await forget(['weekend work']);
    expect(result.deleted).not.toContain('Has photography skills from years of freelance work');
  });
});
