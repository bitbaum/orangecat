/**
 * Search terms in LIKE patterns and PostgREST filters — the one way to put
 * someone's words into a query.
 *
 * There were a dozen copies of `term.replace(/[%_]/g, '\\$&')`. Each missed
 * two things:
 *   - the backslash itself, LIKE's escape character: a term ending in "\"
 *     escaped the closing % and a "\_" in the text unescaped itself;
 *   - PostgREST's own syntax. Inside `.or('a.ilike.%x%,b.ilike.%x%')` a comma
 *     ends a condition and parentheses open a group, so searching "Smith, J"
 *     or "(beta)" broke the filter, or added one the caller never wrote.
 *     PostgREST reads a double-quoted value literally ("…" with \" and \\).
 */

/** Escape LIKE's wildcards and its escape character. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}

/** `%term%` for `.ilike(column, …)` — a plain parameter, no quoting needed. */
export function containsPattern(term: string): string {
  return `%${escapeLike(term)}%`;
}

/**
 * An `.or()` filter matching the term anywhere in any of the columns:
 * `ilikeAny(['title', 'description'], q)` →
 * `title.ilike."%q%",description.ilike."%q%"`.
 */
export function ilikeAny(columns: readonly string[], term: string): string {
  const quoted = `"${containsPattern(term).replace(/["\\]/g, '\\$&')}"`;
  return columns.map(column => `${column}.ilike.${quoted}`).join(',');
}
