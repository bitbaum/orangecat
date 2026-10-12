/**
 * How many typos a word of a given length may carry and still match.
 *
 * The SoundCloud failure — one wrong letter in an artist's name and nothing
 * comes back — is what a budget of zero does. The opposite failure is a short
 * word matching half the dictionary: two edits turn "cat" into "car", "hat",
 * "cut", "at"… So the budget grows with the word, the way Algolia, Typesense
 * and Meilisearch all settled on: none below 4 letters, one from 4, two from 8.
 *
 * Four letters is deliberately the first length with a typo: "cqto" must find
 * "Cato". Pure trigram similarity cannot promise that — "cqto" and "cato"
 * share 2 of 5 trigrams, 0.4, under any useful threshold — which is why this
 * package counts edits instead.
 */

export interface TypoPolicy {
  /** Shortest word allowed one typo. Default 4. */
  oneTypoFrom: number;
  /** Shortest word allowed two typos. Default 8. */
  twoTyposFrom: number;
}

export const DEFAULT_TYPO_POLICY: TypoPolicy = { oneTypoFrom: 4, twoTyposFrom: 8 };

/** Typos allowed for a query word of this many letters. */
export function typoBudget(length: number, policy: TypoPolicy = DEFAULT_TYPO_POLICY): number {
  if (length >= policy.twoTyposFrom) {
    return 2;
  }
  return length >= policy.oneTypoFrom ? 1 : 0;
}
