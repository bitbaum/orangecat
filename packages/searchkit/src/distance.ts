/**
 * How far apart two words are, in typos.
 *
 * A typo is one of the four things fingers do: a wrong letter (cqto → cato),
 * a missing letter (cto), an extra letter (caato), or two letters swapped
 * (ctao). Counting a swap as ONE edit — optimal string alignment, the
 * restricted Damerau–Levenshtein distance — matters: plain Levenshtein counts
 * "ctao" as two, which spends a whole short word's budget on one slip.
 *
 * Both functions stop as soon as the answer must exceed `max`, so checking a
 * query word against thousands of vocabulary words stays cheap.
 */

/**
 * Optimal string alignment distance, or `max + 1` when it is larger than
 * `max`. Strings are compared by code point.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  const s = Array.from(a);
  const t = Array.from(b);
  if (Math.abs(s.length - t.length) > max) {
    return max + 1;
  }
  if (s.length === 0 || t.length === 0) {
    const d = Math.max(s.length, t.length);
    return d > max ? max + 1 : d;
  }
  let prevPrev: number[] = [];
  let prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let d = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        d = Math.min(d, prevPrev[j - 2]! + 1);
      }
      row.push(d);
      if (d < rowMin) {
        rowMin = d;
      }
    }
    if (rowMin > max) {
      return max + 1;
    }
    prevPrev = prev;
    prev = row;
  }
  const d = prev[t.length]!;
  return d > max ? max + 1 : d;
}

/**
 * How many typos it takes to turn `typed` into the START of `word` — the
 * distance that matters while someone is still typing: "bitcon" is one typo
 * from "bitcoin", and "bitco" is zero typos from it. Returns the smallest
 * distance between `typed` and any prefix of `word`, or `max + 1`.
 */
export function prefixDistance(typed: string, word: string, max = Infinity): number {
  const s = Array.from(typed);
  const t = Array.from(word);
  if (s.length === 0) {
    return 0;
  }
  // A prefix longer than typed + max can never be within max; one shorter
  // than typed - max neither. Cap the work at the first typed + max letters.
  const cols = Math.min(t.length, s.length + max);
  let prevPrev: number[] = [];
  let prev = Array.from({ length: cols + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= cols; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let d = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        d = Math.min(d, prevPrev[j - 2]! + 1);
      }
      row.push(d);
      if (d < rowMin) {
        rowMin = d;
      }
    }
    if (rowMin > max) {
      return max + 1;
    }
    prevPrev = prev;
    prev = row;
  }
  const best = Math.min(...prev);
  return best > max ? max + 1 : best;
}
