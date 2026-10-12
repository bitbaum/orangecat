/**
 * Find what was meant: the one search behind the ⌘K palette and Discover.
 *
 *   1. The collection's vocabulary — every word of every public title and
 *      handle — is built once and cached.
 *   2. What was typed is expanded into the vocabulary words within the typo
 *      budget (@bitbaum/searchkit: none under 4 letters, one from 4, two from
 *      8; a swap counts once), so "cqto" also asks for "cato".
 *   3. search_public returns the candidates: exact and prefix matches of what
 *      was typed, or of any correction.
 *   4. searchkit ranks them — fewer typos first, then more words, the title
 *      before the description, the whole name before a prefix — and returns
 *      the ranges that matched, typos included, for marking.
 *
 * When nothing matches, `suggestion` is the closest query made of words that
 * exist ("Did you mean cato?").
 */

import { unstable_cache } from 'next/cache';
import {
  corrections,
  createSearch,
  createVocabulary,
  didYouMean,
  words,
  type Range,
  type Vocabulary,
} from '@bitbaum/searchkit';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  publicSearchText,
  searchPublic,
  type PublicHit,
  type PublicHitType,
} from './public-search';

export interface FoundHit extends PublicHit {
  /** What matched, as ranges into `title` and `snippet`. */
  marks: { title: Range[]; snippet: Range[] };
}

export interface FindResult {
  hits: FoundHit[];
  /** Rows the database matched, before ranking and limit. */
  total: number;
  /** The closest query of existing words, when nothing matched. */
  suggestion: string | null;
}

export interface FindOptions {
  types?: PublicHitType[];
  limit?: number;
  perType?: number;
}

/** Corrections sent per query: enough for a few mistyped words, bounded for the database. */
const MAX_CORRECTIONS = 24;

const cachedWordCounts = unstable_cache(
  async (): Promise<Array<[string, number]>> => {
    const counts = new Map<string, number>();
    for (const text of await publicSearchText(getAdminClient())) {
      for (const word of words(text)) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
    return [...counts];
  },
  ['search-vocabulary'],
  { revalidate: 300 }
);

let vocabularyFor: { source: Array<[string, number]>; vocab: Vocabulary } | null = null;

async function vocabulary(): Promise<Vocabulary> {
  const source = await cachedWordCounts();
  if (vocabularyFor?.source !== source) {
    vocabularyFor = { source, vocab: createVocabulary(source) };
  }
  return vocabularyFor.vocab;
}

/** Rank database candidates by searchkit; anything it cannot place keeps its database order after. */
export function rankFound(query: string, hits: PublicHit[]): FoundHit[] {
  const ranked = createSearch(hits, {
    fields: [
      { name: 'title', get: h => h.title },
      { name: 'handle', get: h => h.handle },
      { name: 'snippet', get: h => h.snippet },
    ],
    rank: h => h.rank,
  }).search(query);
  const placed = new Set(ranked.map(r => r.index));
  return [
    ...ranked.map(r => ({
      ...r.item,
      marks: { title: r.matches.title ?? [], snippet: r.matches.snippet ?? [] },
    })),
    // Matched by the database for a reason the ranker does not see (a word
    // past the snippet, a stemmed form): still a result, just a later one.
    ...hits
      .filter((_, i) => !placed.has(i))
      .map(h => ({ ...h, marks: { title: [], snippet: [] } })),
  ];
}

export async function findPublic(
  query: string,
  { types, limit = 24, perType }: FindOptions = {}
): Promise<FindResult> {
  const typed = query.trim();
  if (!typed) {
    return { hits: [], total: 0, suggestion: null };
  }
  const vocab = await vocabulary();
  const terms = corrections(typed, vocab).slice(0, MAX_CORRECTIONS);
  // Ask for more than will be shown: the database ranks roughly, searchkit
  // decides, and the best answer may sit just past a tight limit.
  const page = await searchPublic(getAdminClient(), {
    query: typed,
    types,
    perType,
    terms,
    limit: Math.min(200, Math.max(limit * 2, 50)),
  });
  const hits = rankFound(typed, page.hits).slice(0, limit);
  return {
    hits,
    total: page.total,
    suggestion: hits.length === 0 ? didYouMean(typed, vocab) : null,
  };
}
