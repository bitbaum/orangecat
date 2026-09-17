/**
 * The semantic fallback and its similarity floor, actually executed.
 *
 * Every other forget test disables embeddings, so the branch that runs when
 * text containment finds NOTHING — and the 0.45 floor it passes to
 * match_cat_memories — was never exercised by any test. The floor was moved
 * from 0.75 to 0.45 on measured production data; a silent revert (or a typo)
 * would have changed which memories a user's "forget that" reaches, and no
 * test would have noticed.
 *
 * bitbaum/orangecat#563 suggestion 17.
 */

import { forgetMemoriesMatching } from '@/services/cat/memory';
import type { AnySupabaseClient } from '@/lib/supabase/types';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mockEmbedText = vi.fn();
vi.mock('@/services/ai/embeddings', () => ({
  embeddingsEnabled: () => true,
  embedText: (...args: unknown[]) => mockEmbedText(...args),
  embedTexts: vi.fn().mockResolvedValue([]),
}));

/** Corpus deliberately shares NO word with the phrase, forcing the RPC path. */
const STORED = { id: 's1', content: 'Knows French' };

function makeClient(rpc: Mock) {
  return {
    from: () => ({
      select: () => ({ eq: async () => ({ data: [STORED], error: null }) }),
      delete: () => ({ eq: () => ({ in: async () => ({ error: null }) }) }),
      insert: async () => ({ error: null }),
      upsert: async () => ({ error: null }),
    }),
    rpc,
  } as unknown as AnySupabaseClient;
}

describe('forget semantic fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
  });

  it('passes the measured 0.45 floor to match_cat_memories', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await forgetMemoriesMatching(makeClient(rpc), 'u1', ['speaking a second language']);

    expect(rpc).toHaveBeenCalledWith(
      'match_cat_memories',
      expect.objectContaining({ p_user_id: 'u1', min_similarity: 0.45 })
    );
  });

  it('deletes what the semantic match returns when no word matched', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [STORED], error: null });
    const result = await forgetMemoriesMatching(makeClient(rpc), 'u1', [
      'speaking a second language',
    ]);

    expect(result.deleted).toEqual(['Knows French']);
    expect(result.notFound).toEqual([]);
  });

  it('is a FALLBACK — a word match never reaches the RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await forgetMemoriesMatching(makeClient(rpc), 'u1', ['French']);

    expect(rpc).not.toHaveBeenCalled();
  });

  it('reports no-match rather than failing when the RPC errors', async () => {
    // A dead embedding path must degrade to "nothing matched", never to a
    // half-truth about what was removed.
    const rpc = vi.fn().mockRejectedValue(new Error('vector index offline'));
    const result = await forgetMemoriesMatching(makeClient(rpc), 'u1', [
      'speaking a second language',
    ]);

    expect(result.deleted).toEqual([]);
    expect(result.notFound).toEqual(['speaking a second language']);
  });
});
