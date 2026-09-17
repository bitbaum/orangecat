#!/usr/bin/env node
/**
 * The public changelog must not silently rot.
 *
 * `src/config/changelog.ts` is hand-written prose, which is the right call —
 * the alternative was piping Loki's internal session log (`dev_log`) straight
 * onto a public page, and those entries are written for the agent that comes
 * next, not for a reader deciding whether to trust this platform.
 *
 * But hand-written means someone has to write it, and nothing was checking.
 * The newest entry sat at 2026-07-31 while main ran on to PR #1063 — six weeks
 * and roughly a hundred merges during which the page told visitors nothing had
 * happened. A page that is stale is worse than no page: it answers the question
 * "is this alive?" with a confident no.
 *
 * So: this is the smallest thing that makes it a habit instead of a chore
 * somebody remembers. It does not check that entries are GOOD — no script can —
 * only that the record has been touched while the product moved.
 *
 *   CHANGELOG_MAX_AGE_DAYS=45 node scripts/check-changelog-fresh.mjs
 */

import { readFileSync } from 'node:fs';

const FILE = 'src/config/changelog.ts';
const MAX_AGE_DAYS = Number(process.env.CHANGELOG_MAX_AGE_DAYS ?? 30);

const source = readFileSync(FILE, 'utf8');
const dates = [...source.matchAll(/date:\s*'(\d{4}-\d{2}-\d{2})'/g)].map(m => m[1]).sort();

if (dates.length === 0) {
  // A regex that matches nothing would make this gate a green light over an
  // unchecked invariant — the exact failure it exists to prevent elsewhere.
  console.error(`❌ ${FILE}: no dated entries found. Has the file's shape changed?`);
  process.exit(1);
}

const newest = dates[dates.length - 1];
const ageDays = Math.floor((Date.now() - Date.parse(`${newest}T00:00:00Z`)) / 86_400_000);

if (ageDays > MAX_AGE_DAYS) {
  console.error(
    `❌ changelog is ${ageDays} days old — newest entry is ${newest}, limit is ${MAX_AGE_DAYS}.\n` +
      `\n` +
      `   Add what shipped to ${FILE}. Entries are user-facing: describe the\n` +
      `   change from the reader's side, not the commit. If nothing user-facing\n` +
      `   shipped, say that in an entry rather than raising the limit.\n` +
      `\n` +
      `   git log origin/main --since=${newest} --format='%ad %s' --date=short\n`
  );
  process.exit(1);
}

console.log(
  `✅ changelog fresh — newest entry ${newest} (${ageDays} day${ageDays === 1 ? '' : 's'} old, limit ${MAX_AGE_DAYS}), ${dates.length} entries`
);
