/**
 * Who belongs in a list of people, as filters on a profiles query — applied
 * BEFORE the query pages.
 *
 * The People page's "Everyone" used to read the newest 100 rows and drop
 * fixtures afterwards, so the page that reached the browser was a handful of
 * nameless `user_…` sign-ups and a search for a real person missed them. The
 * rules are the public directory's (src/config/public-directory.ts): CI and
 * audit fixtures out, and a nameless shell (a handle the platform minted and
 * no display name) out. Someone who chose a handle but no name stays.
 */

import {
  EXACT_FIXTURE_USERNAMES,
  FIXTURE_DISPLAY_NAME_PATTERN,
  FIXTURE_USERNAME_ILIKE_PATTERNS,
} from '@/config/public-directory';
import { MINTED_HANDLE_RE } from '@/config/usernames';

/** A PostgREST filter value, quoted so commas, braces and backslashes stay text. */
const quoted = (value: string) => `"${value.replace(/["\\]/g, '\\$&')}"`;

/** The `.or()` filter that keeps everyone but a nameless shell. */
export const NOT_A_NAMELESS_SHELL = `username.not.imatch.${quoted(MINTED_HANDLE_RE.source)},name.imatch.${quoted('\\S')}`;

/** The `.or()` filter that keeps everyone but a fixture's display name (a null name passes). */
export const NOT_A_FIXTURE_NAME = `name.is.null,name.not.imatch.${quoted(FIXTURE_DISPLAY_NAME_PATTERN)}`;

interface FilterableQuery {
  not(column: string, operator: string, value: unknown): FilterableQuery;
  neq(column: string, value: unknown): FilterableQuery;
  or(filters: string): FilterableQuery;
}

/**
 * Narrow a profiles query to people a visitor came to find. Typed loosely on
 * purpose: the builder's own type, re-derived on every step, is deep enough to
 * stall tsc in a loop (see findPeople.ts), so the caller casts back.
 */
export function onlyPublicPeople<Q>(query: Q): Q {
  let q = (query as unknown as FilterableQuery).not('username', 'is', null);
  for (const pattern of FIXTURE_USERNAME_ILIKE_PATTERNS) {
    q = q.not('username', 'ilike', pattern);
  }
  for (const name of EXACT_FIXTURE_USERNAMES) {
    q = q.neq('username', name);
  }
  q = q.or(NOT_A_NAMELESS_SHELL).or(NOT_A_FIXTURE_NAME);
  return q as unknown as Q;
}
