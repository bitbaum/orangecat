/**
 * Query → search tokens, shared by every keyword search the Cat runs.
 *
 * Pure and dependency-free on purpose: the platform search (which may also
 * embed) and the cat-watches timer (which must never reach an AI provider)
 * both tokenize the same way, so "Lightning" means the same thing in a search
 * and in a standing watch.
 */

/** Query-framing words that add noise to matchmaking searches, not signal. */
const SEARCH_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'you',
  'your',
  'who',
  'whom',
  'find',
  'need',
  'want',
  'looking',
  'someone',
  'anyone',
  'somebody',
  'collaborate',
  'collaboration',
  'collaborator',
  'partner',
  'platform',
  'orangecat',
  'people',
  'person',
  'can',
  'help',
  'near',
  'about',
]);

const MAX_TOKENS = 6;

/**
 * Significant words of a query (≥3 chars, no stopwords, at most six). Split on
 * non-alphanumerics, so every token is safe to embed in a PostgREST `.or()`
 * string. Falls back to the whole query, stripped, when no word survives.
 */
export function searchTokens(query: string): string[] {
  const q = query.trim().toLowerCase();
  const tokens = q
    .split(/[^a-z0-9]+/i)
    .filter(t => t.length >= 3 && !SEARCH_STOPWORDS.has(t))
    .slice(0, MAX_TOKENS);
  if (tokens.length > 0) {
    return tokens;
  }
  const whole = q.replace(/[^a-z0-9 ]+/g, '').trim();
  return whole ? [whole] : [];
}

/** Build a PostgREST `.or()` string: any token, in any field. */
export function ilikeOrConditions(fields: string[], tokens: string[]): string {
  return tokens.flatMap(t => fields.map(f => `${f}.ilike.%${t}%`)).join(',');
}

/**
 * Does this text mention the keyword? The whole phrase, or every one of its
 * significant words — "Lightning network" matches a post about "the network
 * effects of Lightning", but "Bitcoin education" does not match a post that
 * only says "Bitcoin". Stricter than the search's OR on purpose: a watch
 * interrupts someone, a search result does not.
 */
export function textMatchesKeyword(text: string, keyword: string): boolean {
  const hay = text.toLowerCase();
  const phrase = keyword.trim().toLowerCase();
  if (!phrase) {
    return true;
  }
  if (hay.includes(phrase)) {
    return true;
  }
  const tokens = searchTokens(phrase);
  return tokens.length > 0 && tokens.every(t => hay.includes(t));
}
