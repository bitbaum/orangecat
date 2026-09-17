/**
 * Who and what belongs on public directories (Discover, People).
 *
 * CI and workflow audits mint disposable users and groups. Those rows are
 * real in the database; they are not people a visitor came to find.
 *
 * The rules live here once — as data (patterns, exact names) rather than a
 * hand-written SQL clause — so a SQL-level filter (a query builder, or a
 * `count: 'exact', head: true` query, which returns no rows to filter in JS)
 * and `isFixtureUsername()` (a post-fetch JS filter, needed for RPC results
 * a SQL predicate can't reach) can't drift apart. That drift is exactly how
 * discoverCounts.ts's people count went stale against the actual list query
 * it's supposed to badge — it hand-copied two of the JS filter's clauses and
 * missed the rest. A SQL consumer loops `FIXTURE_USERNAME_ILIKE_PATTERNS`
 * through `.not('username', 'ilike', pattern)` and `EXACT_FIXTURE_USERNAMES`
 * through `.neq('username', name)` — see discoverCounts.ts / queries/profiles.ts.
 */

/**
 * `ilike` patterns for CI/audit fixture usernames — safe as SQL filters.
 * `_` is the SQL LIKE single-character wildcard, used deliberately for the
 * `user_<8 hex chars>` shape (`user` + `_` + 8 wildcard chars); everywhere
 * else it's escaped (`\\_`) to mean a literal underscore.
 */
export const FIXTURE_USERNAME_ILIKE_PATTERNS = [
  'e2e-reset-%',
  'e2e\\_%',
  'wf0%',
  'audit-%',
  'audit\\_%',
  'user\\_________',
] as const;

/** Exact `user_<8 hex chars>` shape minted by CI fixtures — the JS-side equivalent of the ilike pattern above. */
const FIXTURE_HEX_USER = /^user_[0-9a-f]{8}$/i;

/**
 * Known CI-tool smoke-test accounts. Exact strings, not a pattern — every
 * entry here is a literal login used by this repo's own E2E/manual test
 * runs, confirmed against @example.com / *.test signups in
 * scripts/db/data_sample.sql, not guessed from a naming convention that
 * could also match a real user's handle.
 */
export const EXACT_FIXTURE_USERNAMES = [
  'curl-test',
  'node-test',
  'fetch-browser-test',
  'playwright-test',
  'profiletest',
  'cypress-test',
  'puppeteer-test',
  'vitest-test',
  'jest-test',
] as const;
const EXACT_FIXTURE_USERNAME_SET = new Set<string>(EXACT_FIXTURE_USERNAMES);

const FIXTURE_DISPLAY_NAME = /^(e2e reset user|user)$/i;
const FIXTURE_GROUP_TITLE = /^(audit\s+wf|ephemeral\s+verify|workflow\s+audit)/i;

/**
 * The named prefixes above are an allow-list of shapes we happened to have seen,
 * and audits keep inventing new ones: "Audit Group 1783191071580" survived the
 * list above and sat in a live account's context switcher.
 *
 * So also match the *generating* signature rather than the wording — an
 * audit-ish first word followed by the millisecond epoch the fixture appends to
 * keep names unique. Keying on the timestamp is what keeps a real group safe: a
 * governance product will one day have an "Audit Committee", and it will not be
 * called "Audit Committee 1783191071580".
 */
const FIXTURE_GROUP_STAMPED = /^(audit|ephemeral|workflow|e2e|wf\d)\b.*\b\d{10,}$/i;

export function isFixtureUsername(username: string | null | undefined): boolean {
  const u = (username ?? '').trim();
  if (u.length === 0) {
    return true;
  }
  const lower = u.toLowerCase();
  if (EXACT_FIXTURE_USERNAME_SET.has(lower)) {
    return true;
  }
  if (FIXTURE_HEX_USER.test(u)) {
    return true;
  }
  return (
    lower.startsWith('e2e-reset-') ||
    lower.startsWith('e2e_') ||
    /^wf0\d+/.test(lower) ||
    lower.startsWith('audit-') ||
    lower.startsWith('audit_')
  );
}

export function isFixtureDisplayName(name: string | null | undefined): boolean {
  return FIXTURE_DISPLAY_NAME.test((name ?? '').trim());
}

export function isFixtureProfile(profile: {
  username?: string | null;
  name?: string | null;
}): boolean {
  return isFixtureUsername(profile.username) || isFixtureDisplayName(profile.name);
}

export function isFixtureGroupTitle(title: string | null | undefined): boolean {
  const t = (title ?? '').trim();
  return FIXTURE_GROUP_TITLE.test(t) || FIXTURE_GROUP_STAMPED.test(t);
}

/**
 * True when a profile's public handle still republishes its owner's email
 * local part — the leak fixed at the write path in
 * supabase/migrations/20260826130000_stop_deriving_usernames_from_email.sql
 * and backfilled by scripts/rename-email-derived-usernames.sql, but not every
 * affected row has been through that backfill yet (it's a deliberate,
 * checked-by-hand operation, not something a schema migration runs
 * automatically — see that script's own header for why).
 *
 * Same predicate as the SQL side's `count_email_derived_usernames()`,
 * including the `.invalid` exception (RFC 2606 — an undeliverable address has
 * no mailbox, so no owner, so no personal information in its local part; see
 * 20260828070000_system_accounts_keep_their_handles.sql for the incident that
 * taught us to carry the exception here too).
 */
export function isEmailDerivedHandle(profile: {
  username?: string | null;
  email?: string | null;
}): boolean {
  const email = (profile.email ?? '').trim().toLowerCase();
  if (!email || email.endsWith('.invalid')) {
    return false;
  }
  const localPart = email.split('@')[0];
  return !!localPart && (profile.username ?? '').trim().toLowerCase() === localPart;
}
