#!/usr/bin/env node
/**
 * File-size gate — enforces the god-file limits from .claude/rules/code-quality.md.
 *
 * Categories (first match wins):
 *   - API routes  (src/app/** /route.ts)                 max 150 lines
 *   - Components  (src/** /*.tsx)                        max 300 lines
 *   - Services    (src/services/**, src/domain/** *.ts)  max 500 lines
 *
 * EXCEPTIONS is a ratchet: it lists every violator that predates this gate.
 * The list only SHRINKS — when a listed file drops under its limit (or is
 * deleted), the stale entry FAILS the gate until removed. Never add new files.
 *
 * Run: node scripts/check-file-sizes.js   (wired into `npm run verify`)
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Exception list (ratchet — may only shrink). Violators as of 2026-08-02.
// ---------------------------------------------------------------------------
const EXCEPTIONS = [
  // Landed on main between this gate's authoring and its merge — baseline, split pending.
  'src/components/receive/ReceiveScreen.tsx',
  // API routes > 150
  'src/app/api/entities/[entityType]/[id]/status/route.ts',
  'src/app/api/groups/[slug]/events/route.ts',
  'src/app/api/cat/permissions/route.ts',
  'src/app/api/ai/form-prefill/route.ts',
  'src/app/api/stakeholders/[id]/route.ts',
  'src/app/api/groups/[slug]/route.ts',
  'src/app/api/bookings/[id]/route.ts',
  'src/app/api/profiles/[userId]/entities/[entityType]/route.ts',
  // Components > 300
  'src/components/wallets/WalletManager/components/WalletForm.tsx',
  'src/app/(authenticated)/dashboard/bookings/[id]/page.tsx',
  'src/components/ai-chat/ModernChatPanel/components/PrefilledFormCard.tsx',
  'src/app/groups/[slug]/settings/page.tsx',
  'src/app/(public)/faq/page.tsx',
  'src/components/groups/GroupMembers.tsx',
  'src/components/timeline/TimelineComposer.tsx',
  'src/components/onboarding/IntelligentOnboarding.tsx',
  'src/components/providers/AuthProvider.tsx',
  'src/app/profiles/[username]/page.tsx',
  'src/components/ai-chat/ModernChatPanel/components/ModelSelector.tsx',
  'src/components/layout/HeaderNavigation.tsx',
  'src/components/public/PublicEntityDetailPage.tsx',
  'src/app/(authenticated)/dashboard/analytics/components/AnalyticsInsights.tsx',
  'src/components/ai-chat/ModernChatPanel/index.tsx',
  'src/components/profile/ProfileOverviewTab.tsx',
  'src/app/(public)/docs/page.tsx',
  'src/components/ai-chat/ModernChatPanel/components/MessageBubble.tsx',
  // Services > 500
  'src/services/cat/system-prompt.ts',
  'src/services/ai/context-sections.ts',
  'src/services/cat/chat-orchestrator.ts',
  'src/services/cat/memory.ts',
  'src/services/cat/nudges.ts',
  'src/services/ai/openrouter.ts',
  'src/services/ai/api-key-service.ts',
  'src/services/cat/permission-service.ts',
];

// ---------------------------------------------------------------------------

const LIMITS = { route: 150, component: 300, service: 500 };

/** Category for a repo-relative posix path, or null when ungated. */
function categorize(rel) {
  if (rel.startsWith('src/app/') && /\/route\.ts$/.test(rel)) return 'route';
  if (rel.endsWith('.tsx')) return 'component';
  if ((rel.startsWith('src/services/') || rel.startsWith('src/domain/')) && rel.endsWith('.ts')) {
    return 'service';
  }
  return null;
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const root = path.resolve(__dirname, '..');
const files = walk(path.join(root, 'src'), []);
const exceptions = new Set(EXCEPTIONS);
const seenViolating = new Set();
const violations = [];

for (const file of files) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const category = categorize(rel);
  if (!category) continue;
  // Count like `wc -l`: newline-terminated lines (no phantom trailing line).
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
  const limit = LIMITS[category];
  if (lines <= limit) continue;
  if (exceptions.has(rel)) {
    seenViolating.add(rel);
    continue;
  }
  violations.push({ rel, category, lines, limit });
}

const stale = EXCEPTIONS.filter(rel => !seenViolating.has(rel));

let failed = false;

if (violations.length) {
  failed = true;
  console.error(`\n✗ ${violations.length} file(s) exceed the size limits:`);
  for (const v of violations) {
    console.error(`  - ${v.rel} (${v.category}: ${v.lines} lines, limit ${v.limit})`);
  }
  console.error(
    '\nSplit the file into cohesive modules (see .claude/rules/code-quality.md).' +
      '\nDo NOT add new entries to the exception list — it only shrinks.'
  );
}

if (stale.length) {
  failed = true;
  console.error(`\n✗ ${stale.length} stale exception(s) — file now under its limit or deleted.`);
  console.error('  Remove from EXCEPTIONS in scripts/check-file-sizes.js (the ratchet):');
  for (const rel of stale) console.error(`  - ${rel}`);
}

if (failed) {
  process.exit(1);
}

console.log(
  `✓ File sizes OK (${files.length} files scanned, ${EXCEPTIONS.length} grandfathered exceptions)`
);
