/**
 * Prove it: the misspellings people make, generated, and a score for whether
 * search still finds the thing.
 *
 * A typo-tolerance claim is only as good as the test set behind it. This
 * builds that set mechanically from your own titles — every wrong letter that
 * sits next to the right one on a keyboard, every dropped letter, every
 * doubled letter, every swapped pair — so "one slip in a name still finds it"
 * becomes a failing test the day it stops being true, instead of a complaint
 * from someone who could not find an artist.
 */
import { words as foldWords } from './normalize.ts';
import { typoBudget, DEFAULT_TYPO_POLICY, type TypoPolicy } from './typo.ts';

/** Physical neighbours on QWERTY and QWERTZ (y and z both neighbour t/u/a/s/x). */
const NEIGHBOURS: Record<string, string> = {
  q: 'wa',
  w: 'qeas',
  e: 'wrds',
  r: 'etdf',
  t: 'ryfg',
  y: 'tughzas',
  u: 'yihj',
  i: 'uojk',
  o: 'ipkl',
  p: 'ol',
  a: 'qwszy',
  s: 'awedxzy',
  d: 'serfcx',
  f: 'drtgvc',
  g: 'ftyhbv',
  h: 'gyujnb',
  j: 'huikmn',
  k: 'jiolm',
  l: 'kop',
  z: 'asxtuh',
  x: 'zsdc',
  c: 'xdfv',
  v: 'cfgb',
  b: 'vghn',
  n: 'bhjm',
  m: 'njk',
};

export type TypoKind = 'neighbour' | 'drop' | 'double' | 'swap';

/**
 * The one-slip misspellings of a (folded) word: a neighbouring key instead of
 * a letter, a letter dropped, a letter doubled, two adjacent letters swapped.
 * De-duplicated, and never the word itself.
 */
export function typoVariants(
  word: string,
  kinds: readonly TypoKind[] = ['neighbour', 'drop', 'double', 'swap']
): string[] {
  const s = Array.from(word);
  const out = new Set<string>();
  for (let i = 0; i < s.length; i++) {
    if (kinds.includes('neighbour')) {
      for (const n of NEIGHBOURS[s[i]!] ?? '') {
        out.add([...s.slice(0, i), n, ...s.slice(i + 1)].join(''));
      }
    }
    if (kinds.includes('drop') && s.length > 1) {
      out.add([...s.slice(0, i), ...s.slice(i + 1)].join(''));
    }
    if (kinds.includes('double')) {
      out.add([...s.slice(0, i + 1), s[i]!, ...s.slice(i + 1)].join(''));
    }
    if (kinds.includes('swap') && i + 1 < s.length && s[i] !== s[i + 1]) {
      out.add([...s.slice(0, i), s[i + 1]!, s[i]!, ...s.slice(i + 2)].join(''));
    }
  }
  out.delete(word);
  return [...out];
}

/** A query and what it should find. */
export interface EvalCase {
  query: string;
  /** Ids that count as the right answer. */
  expect: readonly string[];
}

export interface EvalReport {
  cases: number;
  /** The right answer was first. */
  successAt1: number;
  /** The right answer was in the top 3. */
  successAt3: number;
  /** Mean reciprocal rank of the first right answer (0 when absent). */
  mrr: number;
  /** Share of queries that returned nothing at all. */
  zeroResults: number;
  /** The cases whose answer was not in the top 3, to read. */
  misses: { query: string; expect: readonly string[]; got: readonly string[] }[];
}

/** Run every case through `search` (ids, best first) and score it. */
export async function evaluate(
  cases: readonly EvalCase[],
  search: (query: string) => readonly string[] | Promise<readonly string[]>
): Promise<EvalReport> {
  let at1 = 0;
  let at3 = 0;
  let rr = 0;
  let zero = 0;
  const misses: EvalReport['misses'] = [];
  for (const c of cases) {
    const got = await search(c.query);
    if (got.length === 0) {
      zero++;
    }
    const rank = got.findIndex(id => c.expect.includes(id));
    if (rank === 0) {
      at1++;
    }
    if (rank >= 0 && rank < 3) {
      at3++;
    } else {
      misses.push({ query: c.query, expect: c.expect, got: got.slice(0, 5) });
    }
    rr += rank >= 0 ? 1 / (rank + 1) : 0;
  }
  const n = cases.length || 1;
  return {
    cases: cases.length,
    successAt1: at1 / n,
    successAt3: at3 / n,
    mrr: rr / n,
    zeroResults: zero / n,
    misses,
  };
}

/**
 * Cases from your own names: each name's words, each misspelled once — but
 * only words long enough to be allowed a typo (`typo.ts`), since a 3-letter
 * word with a wrong letter is a different word.
 */
export function typoCases(
  names: readonly { id: string; name: string }[],
  options: { policy?: TypoPolicy; perWord?: number; fold?: (s: string) => string[] } = {}
): EvalCase[] {
  const { policy = DEFAULT_TYPO_POLICY, perWord = Infinity, fold } = options;
  const cases: EvalCase[] = [];
  for (const { id, name } of names) {
    // The search's own words by default: "No-screen" is two words to it, so
    // a slip in "no" must not be generated as "bo-screen".
    const words = fold ? fold(name) : foldWords(name);
    words.forEach((word, i) => {
      if (typoBudget(Array.from(word).length, policy) < 1) {
        return;
      }
      for (const variant of typoVariants(word).slice(0, perWord)) {
        const query = [...words.slice(0, i), variant, ...words.slice(i + 1)].join(' ');
        cases.push({ query, expect: [id] });
      }
    });
  }
  return cases;
}
