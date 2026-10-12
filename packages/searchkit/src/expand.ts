/**
 * Typo tolerance for a search that runs somewhere else — a database, an API.
 *
 * Expand each typed word into the collection's words it could mean, and send
 * those along with what was typed. The database then only has to match words
 * exactly or by prefix, which every one can do with an index; the forgiving
 * part happens here, the same way for every backend.
 *
 * And when nothing matched: `didYouMean` names the closest query made of
 * words that exist, to offer as a one-tap fix.
 */
import { tokenize, writtenLengths } from './normalize.ts';
import { DEFAULT_TYPO_POLICY, type TypoPolicy } from './typo.ts';
import { candidates, type Candidate, type Vocabulary } from './vocabulary.ts';

export interface ExpandedWord {
  /** The word as typed, folded. */
  typed: string;
  /** The collection's words it could mean, best first (exact and prefixes included). */
  candidates: Candidate[];
}

export interface ExpandOptions {
  policy?: TypoPolicy;
  /** Per typed word, at most this many corrected spellings. Default 5. */
  perWord?: number;
  /** The same site spelling rule the vocabulary was built with (`SearchSpec.normalize`). */
  normalize?: (word: string) => string;
}

/** Every typed word with the collection's words it could mean. */
export function expandQuery(
  query: string,
  vocab: Vocabulary,
  options: ExpandOptions = {}
): ExpandedWord[] {
  const { policy = DEFAULT_TYPO_POLICY, perWord = 5, normalize = (w: string) => w } = options;
  const typed = writtenLengths(query, normalize);
  return [...typed].map(([word, writtenLength]) => ({
    typed: word,
    candidates: candidates(vocab, word, { prefix: true, policy, limit: 100, writtenLength })
      .filter(c => c.typos > 0 || !c.prefix || c.term === word)
      .slice(0, perWord),
  }));
}

/**
 * The words to send to an exact/prefix backend so it forgives typos: each
 * correction that is not simply what was typed. "cqto pots" → ["cato", "post"].
 */
export function corrections(query: string, vocab: Vocabulary, options?: ExpandOptions): string[] {
  const out = new Set<string>();
  for (const w of expandQuery(query, vocab, options)) {
    for (const c of w.candidates) {
      if (c.typos > 0) {
        out.add(c.term);
      }
    }
  }
  return [...out];
}

/**
 * The closest query whose words all exist, or null when every word already
 * does (or none can be corrected). Prefers fewer typos, then the commoner word.
 */
export function didYouMean(
  query: string,
  vocab: Vocabulary,
  policy = DEFAULT_TYPO_POLICY
): string | null {
  const typed = tokenize(query).map(t => t.term);
  if (typed.length === 0) {
    return null;
  }
  let changed = false;
  const fixed = typed.map(word => {
    if (vocab.counts.has(word)) {
      return word;
    }
    const best = candidates(vocab, word, { prefix: false, policy, limit: 1 })[0];
    if (best) {
      changed = true;
      return best.term;
    }
    return word;
  });
  return changed ? fixed.join(' ') : null;
}
