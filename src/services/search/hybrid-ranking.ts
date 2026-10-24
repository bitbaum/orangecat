import { words } from '@bitbaum/searchkit';
import type { PublicHit } from './public-search';

export interface SemanticPublicHit extends PublicHit {
  similarity: number;
}
export type HybridPublicHit = PublicHit & { similarity?: number };
const key = (hit: PublicHit) => `${hit.type}:${hit.id}`;
const folded = (text: string) => words(text).join(' ');

/** Reciprocal rank fusion: combine rankings without comparing incompatible scores.
 * A whole title/handle match stays first; ties retain lexical order. */
export function mergePublicRankings(
  query: string,
  lexical: PublicHit[],
  semantic: SemanticPublicHit[],
  limit = 30,
  perType = 5
): HybridPublicHit[] {
  const queryWords = folded(query);
  const entries = new Map<
    string,
    { hit: HybridPublicHit; score: number; order: number; exact: boolean }
  >();
  for (const list of [lexical, semantic]) {
    list.forEach((hit, index) => {
      const id = key(hit);
      const current = entries.get(id);
      const score = 1 / (60 + index + 1);
      if (current) {
        current.score += score;
        if ('similarity' in hit) {
          current.hit = { ...current.hit, similarity: hit.similarity as number };
        }
      } else {
        entries.set(id, {
          hit,
          score,
          order: entries.size,
          exact: Boolean(
            queryWords &&
            (folded(hit.title) === queryWords || (hit.handle && folded(hit.handle) === queryWords))
          ),
        });
      }
    });
  }
  const counts = new Map<string, number>();
  return [...entries.values()]
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score || a.order - b.order)
    .filter(({ hit }) => {
      const count = counts.get(hit.type) ?? 0;
      if (count >= perType) {
        return false;
      }
      counts.set(hit.type, count + 1);
      return true;
    })
    .slice(0, limit)
    .map(entry => entry.hit);
}
