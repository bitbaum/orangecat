#!/usr/bin/env node
/**
 * Gate: only services/social/followList.ts may read the follow-list endpoints.
 *
 * WHY THIS EXISTS
 * /api/social/following|followers/[id] answer
 *   { success, data: { data: [...], pagination } }
 * — the rows sit TWO levels deep. Three call sites unwrapped that by hand and
 * one read `data.data` (the object) through an `Array.isArray()` guard. It
 * failed silently, so the profile page's Follow button never learned you
 * already followed someone: it always read "Follow", and clicking it returned
 * 409 "Already following this user". A user hit exactly that in production on
 * 2026-09-05.
 *
 * standardResponse.contract.test.ts already pins the envelope after 16 such
 * bugs were fixed in April 2026 — and this one still survived, because pinning
 * the SHAPE does not stop a new caller from unwrapping it wrong. So the rule is
 * structural instead: there is one reader, and everyone goes through it.
 *
 * Run: node scripts/check-follow-envelope.mjs
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const READER = 'src/services/social/followList.ts';
const CONTRACT_TEST = '__tests__/unit/api/follow-list-envelope.test.ts';

/** Files allowed to name the follow-list routes: the reader, its test, the routes themselves, the route registry. */
const ALLOWED = new Set([
  READER,
  CONTRACT_TEST,
  'src/config/api-routes.ts',
  'src/lib/api/followListRoute.ts',
  'src/app/api/social/following/[id]/route.ts',
  'src/app/api/social/followers/[id]/route.ts',
  'src/app/api/social/follow-status/[id]/route.ts',
]);

/** How a caller reaches those endpoints: via the registry, or by raw path. */
const PATTERNS = [
  'API_ROUTES.SOCIAL.FOLLOWING',
  'API_ROUTES.SOCIAL.FOLLOWERS',
  'API_ROUTES.SOCIAL.FOLLOW_STATUS',
  'api/social/following',
  'api/social/followers',
  'api/social/follow-status',
];

function trackedSourceFiles() {
  const out = execSync('git ls-files "src/*.ts" "src/*.tsx" "__tests__/*.ts" "__tests__/*.tsx"', {
    encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

const violations = [];

for (const file of trackedSourceFiles()) {
  if (ALLOWED.has(file)) {
    continue;
  }
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const pattern of PATTERNS) {
    if (content.includes(pattern)) {
      const line = content.split('\n').findIndex(l => l.includes(pattern)) + 1;
      violations.push({ file, line, pattern });
      break;
    }
  }
}

// The reader must still exist and still own the nested unwrap — a gate that
// points at a deleted or gutted file protects nothing.
let readerSource = '';
try {
  readerSource = readFileSync(READER, 'utf8');
} catch {
  console.error(`✗ check:follow-envelope — the single reader ${READER} is missing.`);
  process.exit(1);
}
if (!readerSource.includes('parseFollowListResponse')) {
  console.error(`✗ check:follow-envelope — ${READER} no longer exports parseFollowListResponse.`);
  process.exit(1);
}

if (violations.length > 0) {
  console.error('✗ check:follow-envelope — follow-list endpoints read outside the shared reader:\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  uses ${v.pattern}`);
  }
  console.error(
    `\n  These endpoints nest their rows two levels deep ({ data: { data: [...] } }).` +
      `\n  Hand-unwrapping it is how the Follow button broke. Import from` +
      `\n  '@/services/social/followList' instead:` +
      `\n    fetchFollowList('following' | 'followers', userId) -> FollowListRow[]` +
      `\n    fetchFollowingIds(userId) -> string[]\n`
  );
  process.exit(1);
}

console.log('✓ check:follow-envelope — follow-list endpoints read only through the shared reader');
