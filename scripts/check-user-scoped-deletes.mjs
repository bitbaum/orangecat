#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * check-user-scoped-deletes.mjs — every DELETE on a per-user Cat table names
 * the user.
 *
 * Cat's memory tables hold one row per user with no other tenancy boundary in
 * the query itself. Six deletes in `src/services/cat/memory.ts` remove rows;
 * four already filtered on `user_id`, and the two PRUNE paths did not — they
 * deleted purely by `id`, on ids fetched moments earlier by a user-scoped
 * query.
 *
 * That was safe, and only conditionally: the ids were right, and the client was
 * RLS-scoped. Neither is guaranteed by the code that does the deleting. Three
 * other paths in this service already use `getAdminClient()`, where RLS is not
 * a backstop at all — hand one of those to a prune and it deletes across users,
 * silently, from a function whose job is routine cleanup nobody watches.
 *
 * The second instance is the reason this gate exists rather than a third fix:
 * `recordForgottenFacts` says "same pattern as memory pruning" in its own
 * comment, and inherited the gap along with the pattern. bitbaum/orangecat#563
 * finding 13.
 *
 * Deliberately narrow: it checks the Cat memory service, where the invariant is
 * uniform and the tables are strictly per-user. Widening it to every table in
 * the app would need a per-table notion of ownership that does not exist yet,
 * and a gate that has to guess is a gate that gets muted.
 */

import { readFileSync } from 'node:fs';

const FILES = [
  'src/services/cat/memory.ts',
  'src/services/cat/economic-profile.ts',
  'src/services/companions/memory.ts',
];

/**
 * A delete and the statement that follows it, up to the terminating `;`.
 * Chains here are short and always end in one, so this needs no JS parser.
 */
function deleteStatements(source) {
  const found = [];
  const re = /\.delete\(\)/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const end = source.indexOf(';', m.index);
    const line = source.slice(0, m.index).split('\n').length;
    found.push({ line, text: source.slice(m.index, end === -1 ? source.length : end) });
  }
  return found;
}

let offenders = 0;
let checked = 0;

for (const file of FILES) {
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const stmt of deleteStatements(source)) {
    checked += 1;
    if (!/\.eq\(\s*['"]user_id['"]/.test(stmt.text)) {
      offenders += 1;
      console.error(`✗ ${file}:${stmt.line} — DELETE does not filter on user_id`);
      console.error(`    ${stmt.text.replace(/\s+/g, ' ').slice(0, 100)}`);
    }
  }
}

if (offenders > 0) {
  console.error('');
  console.error('  These tables are strictly per-user, and the delete is the last place');
  console.error('  that can say so. RLS is a backstop, not the rule: three paths in this');
  console.error('  service already run under getAdminClient(), where there is no backstop.');
  console.error('  Add .eq(\'user_id\', userId) — the other deletes in these files all do.');
  process.exit(1);
}

console.log(`✓ user-scoped deletes: ${checked} delete(s) checked, all filter on user_id`);
