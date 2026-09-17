/**
 * A forget phrase must match WORDS, not letter runs.
 *
 * The containment branch compared raw substrings both ways, and
 * MIN_FORGET_FRAGMENT_CHARS allows four-character facts. So "work" was
 * contained in "network", "framework", "coworking" and "homework — every one
 * of those memories was deleted by a user asking to forget "work".
 *
 * This is the opposite failure to #563 finding 8, and the worse one: that bug
 * told the user something was still there when it was gone, this one silently
 * destroys memories they never asked to remove, and Cat then reports them as
 * deleted — accurately, which is what makes it hard to notice.
 *
 * bitbaum/orangecat#563 finding 9.
 */

import { forgetMemoriesMatching } from '@/services/cat/memory';
import type { AnySupabaseClient } from '@/lib/supabase/types';

interface Row {
  id: string;
  content: string;
}

function supabaseWithCorpus(corpus: Row[]) {
  const deleted: string[][] = [];
  const client = {
    from: () => ({
      select: () => ({ eq: async () => ({ data: corpus, error: null }) }),
      delete: () => ({
        eq: () => ({
          in: async (_col: string, ids: string[]) => {
            deleted.push(ids);
            return { error: null };
          },
        }),
      }),
    }),
    rpc: async () => ({ data: [], error: null }),
  } as unknown as AnySupabaseClient;
  return { client, deleted };
}

const CORPUS: Row[] = [
  { id: 'm1', content: 'Builds neural networks for a living' },
  { id: 'm2', content: 'Prefers the React framework' },
  { id: 'm3', content: 'Uses a coworking space in Zurich' },
  { id: 'm4', content: 'Does not like work on weekends' },
  { id: 'm5', content: 'Knows French' },
];

describe('forget matches words, not letter runs', () => {
  it('forgetting "work" leaves network, framework and coworking alone', async () => {
    const { client } = supabaseWithCorpus(CORPUS);
    const result = await forgetMemoriesMatching(client, 'u1', ['work']);

    // Only the memory that contains the actual WORD "work".
    expect(result.deleted).toEqual(['Does not like work on weekends']);
    expect(result.deleted).not.toContain('Builds neural networks for a living');
    expect(result.deleted).not.toContain('Prefers the React framework');
    expect(result.deleted).not.toContain('Uses a coworking space in Zurich');
  });

  it('still matches the whole word inside a longer sentence', async () => {
    // The fix must not break the thing containment is FOR.
    const { client } = supabaseWithCorpus(CORPUS);
    const result = await forgetMemoriesMatching(client, 'u1', ['French']);

    expect(result.deleted).toEqual(['Knows French']);
  });

  it('matches a multi-word phrase on word boundaries', async () => {
    const { client } = supabaseWithCorpus([
      { id: 'a', content: 'Uses a coworking space in Zurich' },
      { id: 'b', content: 'Has a coworkings pass' },
    ]);
    const result = await forgetMemoriesMatching(client, 'u1', ['coworking space']);

    expect(result.deleted).toEqual(['Uses a coworking space in Zurich']);
  });

  it('does not match a prefix of a longer word', async () => {
    const { client } = supabaseWithCorpus([
      { id: 'a', content: 'Is a constructor at heart' },
      { id: 'b', content: 'Has one constraint: weekends' },
    ]);
    // "constra" is a fragment of "constraint" — not a word anywhere.
    const result = await forgetMemoriesMatching(client, 'u1', ['constru']);

    expect(result.deleted).toEqual([]);
    expect(result.notFound).toEqual(['constru']);
  });

  it('treats an accented word as a whole word', async () => {
    // `\b` is ASCII-only in JS — it would see "café" as ending after "caf" and
    // happily match inside "cafétéria". The stemmer does NOT unify these (its
    // suffix list cannot turn "cafétéria" into "café"), so containment is the
    // only branch in play and this isolates the boundary check.
    const { client } = supabaseWithCorpus([
      { id: 'a', content: 'Runs a café in Zurich' },
      { id: 'b', content: 'Prefers cafétéria food' },
    ]);
    const result = await forgetMemoriesMatching(client, 'u1', ['café']);

    expect(result.deleted).toEqual(['Runs a café in Zurich']);
  });

  it('still lets the STEMMER unify a plural — that is its job, not a boundary bug', async () => {
    // "cafés" → "café" is the same mechanism that makes "weekends" match
    // "weekend" and "photography" match "photographer". Deliberately unchanged:
    // this fix narrows raw containment, it does not touch stemming.
    const { client } = supabaseWithCorpus([{ id: 'a', content: 'Reviews cafés for a blog' }]);
    const result = await forgetMemoriesMatching(client, 'u1', ['café']);

    expect(result.deleted).toEqual(['Reviews cafés for a blog']);
  });
});
