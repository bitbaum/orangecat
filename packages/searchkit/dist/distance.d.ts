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
export declare function editDistance(a: string, b: string, max?: number): number;
/**
 * How many typos it takes to turn `typed` into the START of `word` — the
 * distance that matters while someone is still typing: "bitcon" is one typo
 * from "bitcoin", and "bitco" is zero typos from it. Returns the smallest
 * distance between `typed` and any prefix of `word`, or `max + 1`.
 */
export declare function prefixDistance(typed: string, word: string, max?: number): number;
