#!/usr/bin/env node
/**
 * "Who is reading?" gets exactly one answer, from one place.
 *
 * Six copies of `getCurrentUserId` had accumulated across services — timeline
 * queries, timeline processors, groups, loans, projects, and the auth layer —
 * each one an uncached network call to /auth/v1/user. A single timeline load
 * asked the server who the reader was repeatedly, and on the critical path:
 * the lookup ran after the feed returned and gated the reaction queries.
 *
 * They were collapsed onto src/services/supabase/auth/session.ts, which caches
 * the in-flight promise. This gate exists so the seventh copy is a red build
 * rather than another silent round-trip: a duplicate is easy to reintroduce,
 * costs nothing visible, and nothing else would ever catch it.
 *
 * Definitions are what this counts. Re-exports (`export { getCurrentUserId }
 * from ...`) are the intended way to expose it from a service's own module.
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const OWNER = 'src/services/supabase/auth/session.ts';

/**
 * A caller may legitimately pass its own Supabase client — a per-request server
 * client, where a module-level cache would hand one request's user to the next.
 * Those wrappers take a client parameter and delegate when there isn't one.
 */
const DELEGATING_WRAPPERS = new Set(['src/services/groups/utils/helpers.ts']);

const files = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx"', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const defines = [];
for (const file of files) {
  const body = readFileSync(file, 'utf8');
  // A definition, not a re-export or an import.
  if (/export\s+(async\s+)?function\s+getCurrentUserId\b/.test(body)) {
    defines.push(file);
  }
}

const unexpected = defines.filter(f => f !== OWNER && !DELEGATING_WRAPPERS.has(f));

if (!defines.includes(OWNER)) {
  console.error(`✗ ${OWNER} no longer defines getCurrentUserId.`);
  console.error('  That file is the single definition. Move it back, or update this gate');
  console.error('  deliberately — do not let the definition drift somewhere unnoticed.');
  process.exit(1);
}

if (unexpected.length > 0) {
  console.error('✗ getCurrentUserId is defined in more than one place:');
  for (const f of unexpected) {
    console.error(`  - ${f}`);
  }
  console.error('');
  console.error(`Import or re-export it from ${OWNER} instead:`);
  console.error("  export { getCurrentUserId } from '@/services/supabase/auth/session';");
  console.error('');
  console.error('Every copy is an uncached round-trip to /auth/v1/user. Six of them once');
  console.error('shared one page load. If your caller must pass its own Supabase client,');
  console.error('add it to DELEGATING_WRAPPERS in this script and delegate when it has none.');
  process.exit(1);
}

console.log(
  `check:one-current-user passed — getCurrentUserId defined once (${OWNER})` +
    (DELEGATING_WRAPPERS.size ? `, ${DELEGATING_WRAPPERS.size} delegating wrapper(s)` : '')
);
