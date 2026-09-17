import { forgetMemoriesMatching } from '@/services/cat/memory';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/**
 * forget_memories is the honesty contract for Cat's memory: the tool must
 * delete what actually matches and report EXACTLY what happened, because the
 * model repeats this result to the user verbatim. The founding bug: Cat said
 * "I've removed photography/French/ceramics" while all three memories stayed —
 * there was no tool at all, so the model fabricated success.
 */

interface Row {
  id: string;
  content: string;
}

function supabaseWithCorpus(corpus: Row[], opts: { deleteError?: unknown } = {}) {
  const deleted: string[][] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: corpus, error: null }),
      }),
      delete: () => ({
        eq: () => ({
          in: async (_col: string, ids: string[]) => {
            deleted.push(ids);
            return { error: opts.deleteError ?? null };
          },
        }),
      }),
    }),
    // Embeddings are disabled in unit tests (no provider env), so the RPC
    // path is never hit; text containment is the behavior under test.
    rpc: async () => ({ data: [], error: null }),
  } as unknown as AnySupabaseClient;
  return { client, deleted };
}

const CORPUS: Row[] = [
  { id: 'm1', content: 'Has photography skills, speaks French, and makes handmade ceramics.' },
  { id: 'm2', content: 'Owns a drone.' },
  { id: 'm3', content: 'Wants to earn extra income on weekends.' },
];

describe('forgetMemoriesMatching', () => {
  it('deletes memories containing the requested fact (either direction)', async () => {
    const { client, deleted } = supabaseWithCorpus(CORPUS);
    const result = await forgetMemoriesMatching(client, 'u1', ['photography']);
    expect(deleted[0]).toEqual(['m1']);
    expect(result.deleted).toEqual([CORPUS[0].content]);
    expect(result.notFound).toEqual([]);
  });

  it('one call can match multiple facts across multiple memories', async () => {
    const { client, deleted } = supabaseWithCorpus(CORPUS);
    // Text mode requires a majority of the fact's significant (stemmed) words
    // to appear in the memory; looser phrasings are caught by the embeddings path.
    const result = await forgetMemoriesMatching(client, 'u1', [
      'speaks French',
      'income on weekends',
    ]);
    expect(deleted[0]).toEqual(expect.arrayContaining(['m1', 'm3']));
    expect(result.deleted).toHaveLength(2);
  });

  it('reports notFound honestly instead of claiming success', async () => {
    const { client, deleted } = supabaseWithCorpus(CORPUS);
    const result = await forgetMemoriesMatching(client, 'u1', ['plays the tuba']);
    expect(deleted).toHaveLength(0);
    expect(result.deleted).toEqual([]);
    expect(result.notFound).toEqual(['plays the tuba']);
  });

  // Was: `expect(result.notFound).toEqual(['photography'])`. That assertion
  // pinned the bug — a failed DELETE reported the fact as "not found", so Cat
  // told the user no such memory existed while it was still stored. The store
  // matched it; the removal is what failed. bitbaum/orangecat#563 finding 8.
  it('a failed delete reports the memory as FAILED, never as absent', async () => {
    const { client } = supabaseWithCorpus(CORPUS, { deleteError: { message: 'boom' } });
    const result = await forgetMemoriesMatching(client, 'u1', ['photography']);
    expect(result.deleted).toEqual([]);
    expect(result.notFound).not.toContain('photography');
    expect(result.failed.length).toBeGreaterThan(0);
  });

  it('ignores degenerate fragments that would match everything', async () => {
    const { client, deleted } = supabaseWithCorpus(CORPUS);
    const result = await forgetMemoriesMatching(client, 'u1', ['a', ' is ']);
    expect(deleted).toHaveLength(0);
    expect(result.deleted).toEqual([]);
  });
});

/**
 * Regression: 2026-08-02 prod incident. The user said "photography, handmade
 * ceramics, and French don't apply to me, and the weekends-only availability
 * is wrong — forget all of those"; the model passed exactly these phrases and
 * NOTHING was deleted, because matching required exact substrings
 * ("photography" ≠ "photographer", "ceramics" ≠ "ceramic", "speaking" ≠
 * "speaks") and the semantic floor (0.75) sat above what real phrasings score
 * (0.39–0.61). These tests pin the stemmed lexical layer with the user's
 * actual stored memories; embeddings are disabled in the unit env.
 */
const INCIDENT_CORPUS: Row[] = [
  { id: 'i1', content: 'Username is @mao.' },
  { id: 'i2', content: 'Wants to make extra income on the side.' },
  {
    id: 'i3',
    content:
      'Has full-stack web development (React/Node/TypeScript), product & UX design, and basic Bitcoin/Lightning knowledge.',
  },
  { id: 'i4', content: 'Wants to earn extra income on weekends.' },
  { id: 'i5', content: 'Owns a drone.' },
  { id: 'i6', content: 'Selling a handmade ceramic coffee mug for CHF 40' },
  { id: 'i7', content: 'Creates product listings for handcrafted items' },
  { id: 'i8', content: 'Knows French' },
  { id: 'i9', content: 'Can only work on weekends.' },
  {
    id: 'i10',
    content:
      'Is a professional photographer who speaks fluent French and owns a rarely used drone.',
  },
  { id: 'i11', content: 'Has a documentary photography background' },
  { id: 'i12', content: 'Prefers Lightning over on-chain payments' },
];

describe('forgetMemoriesMatching — 2026-08-02 incident regression (stemming)', () => {
  it('stemming still reaches inflected forms when enough words match', async () => {
    const { client } = supabaseWithCorpus(INCIDENT_CORPUS);
    // "handmade ceramics" → "handmade ceramic mug": both stems hit, so the
    // inflection ceramics→ceramic is matched WITHOUT the unsafe 1-of-2 rule.
    const result = await forgetMemoriesMatching(client, 'u1', ['handmade ceramics']);
    expect(result.deleted).toEqual(['Selling a handmade ceramic coffee mug for CHF 40']);
    expect(result.notFound).toEqual([]);
  });

  it('a single word the user names matches on containment alone', async () => {
    const { client } = supabaseWithCorpus(INCIDENT_CORPUS);
    // One significant stem → one hit required, and plain containment covers
    // both photography memories. This is how a user removes a whole topic.
    const result = await forgetMemoriesMatching(client, 'u1', ['photography']);
    expect(result.deleted).toEqual(
      expect.arrayContaining([
        'Has a documentary photography background',
        'Is a professional photographer who speaks fluent French and owns a rarely used drone.',
      ])
    );
    expect(result.deleted).toHaveLength(2);
  });

  it('a single shared stem NEVER deletes an unrelated memory (data-loss guard)', async () => {
    // The 2026-08-02 regression: a majority rule made two-word facts need only
    // ONE stem hit, so forgetting "photography skills" also deleted "Has
    // strong cooking skills" — they share nothing but "skill".
    const { client } = supabaseWithCorpus([
      { id: 'k1', content: 'Has strong cooking skills' },
      { id: 'k2', content: 'Has photography skills' },
      { id: 'k3', content: 'Has excellent teaching skills' },
    ]);
    const result = await forgetMemoriesMatching(client, 'u1', ['photography skills']);
    expect(result.deleted).toEqual(['Has photography skills']);
    expect(result.deleted).not.toContain('Has strong cooking skills');
    expect(result.deleted).not.toContain('Has excellent teaching skills');
  });

  it('a one-shared-stem paraphrase is left to the semantic layer, not deleted lexically', async () => {
    // "speaking French" vs "Knows French" share only the stem "french". In
    // prod embeddings score this 0.61 (well over the 0.45 floor) and it IS
    // deleted; lexically it must NOT be, or the cooking-skills bug returns.
    const { client } = supabaseWithCorpus([
      { id: 'f1', content: 'Knows French' },
      { id: 'f2', content: 'Loves French cinema' },
    ]);
    const result = await forgetMemoriesMatching(client, 'u1', ['speaking French']);
    expect(result.deleted).toEqual([]);
    expect(result.notFound).toEqual(['speaking French']);
  });

  it('never touches unrelated memories', async () => {
    const { client } = supabaseWithCorpus(INCIDENT_CORPUS);
    const result = await forgetMemoriesMatching(client, 'u1', [
      'photography skills',
      'handmade ceramics',
      'speaking French',
    ]);
    for (const survivor of [
      'Username is @mao.',
      'Wants to make extra income on the side.',
      'Has full-stack web development (React/Node/TypeScript), product & UX design, and basic Bitcoin/Lightning knowledge.',
      'Owns a drone.',
      'Prefers Lightning over on-chain payments',
    ]) {
      expect(result.deleted).not.toContain(survivor);
    }
  });

  it('a 3-word fact needs a 2-token majority — one shared word is not enough', async () => {
    // "weekend availability constraint" shares only "weekend" with both
    // weekend memories; deleting the income GOAL over one shared word would be
    // over-deletion. In prod the semantic layer (floor 0.45) resolves this:
    // "Can only work on weekends." scores 0.52, the goal only 0.41.
    const { client } = supabaseWithCorpus(INCIDENT_CORPUS);
    const result = await forgetMemoriesMatching(client, 'u1', ['weekend availability constraint']);
    expect(result.deleted).toEqual([]);
    expect(result.notFound).toEqual(['weekend availability constraint']);
  });

  it('stem equality never fires on mere prefix overlap (constraint ≠ construction)', async () => {
    const { client } = supabaseWithCorpus([
      { id: 'c1', content: 'Works in construction management' },
    ]);
    const result = await forgetMemoriesMatching(client, 'u1', ['constraint']);
    expect(result.deleted).toEqual([]);
    expect(result.notFound).toEqual(['constraint']);
  });
});
