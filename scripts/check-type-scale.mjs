#!/usr/bin/env node
/**
 * Font sizes come from the scale, not from square brackets.
 *
 * `tailwind.config.ts` defines the type scale — 2xs / xs / sm / post / base /
 * lg / xl / 2xl … — and an arbitrary `text-[15px]` bypasses it. That value is
 * one nothing else can reference, no theme change can reach, and no audit can
 * find without knowing to look for it. It is the same defect as a hardcoded
 * hex in a `bg-[#…]`, which this repo already forbids.
 *
 * Measured in the production timeline before this gate existed: ten distinct
 * size/weight pairs in one feed, including body copy at an arbitrary 15px and
 * a separator dot rendering 16px among 14px siblings. Ten decisions where
 * five were intended.
 *
 * This is a RATCHET, not a wall. Thirteen instances predate it, spread across
 * settings, messaging and form components. The count may fall or hold. It may
 * never rise: a new one is a build failure, and fixing an old one means
 * lowering the number below, in the same commit, so the improvement is
 * recorded rather than quietly re-spent.
 *
 * Stylesheets are read too. The gate once listed only .ts and .tsx, so
 * `.ui-kicker { @apply text-[10px] }` in globals.css passed it for months.
 *
 * A second ratchet holds `text-2xs` (10px). It is the size of a count in a
 * badge or a keyboard hint, and it had spread to copy: the tagline above the
 * home headline, "On OrangeCat right now", the kind on every Discover card,
 * all at 10px on a phone and 12px on a desk — the scale reversed. 228
 * elements rendered under 12px when it was measured (2026-11-12).
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/** Lower a baseline when you remove instances. Never raise one. */
const RATCHETS = [
  {
    name: 'arbitrary font sizes',
    pattern: /\btext-\[[0-9]/,
    // 14 → 13 on 2026-08-29: the timeline's post body moved from `text-[15px]`
    // to the named `text-post` token. 8 → 7 on 2026-11-12: the old messages UI
    // went to @bitbaum/chatkit/messenger.
    baseline: 7,
    advice: [
      'Use a size from the scale in tailwind.config.ts, or add a NAMED one',
      'there if the size is a real decision (as `post` = 15px is).',
      'An arbitrary value is unreachable by theming and invisible to audits.',
    ],
  },
  {
    name: '10px text (text-2xs)',
    pattern: /\btext-2xs\b/,
    // 36 before the 2026-11-12 sweep of the public fold, Discover and profile
    // tabs. What is left is settings chips, palette hints and image captions.
    baseline: 28,
    advice: [
      'text-2xs is for a count in a badge or a keyboard hint. Words a person',
      'reads are text-xs (12px) or larger, on a phone first.',
    ],
  },
];

const files = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx" "src/**/*.css"', {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);
const sources = files.map(file => ({ file, lines: readFileSync(file, 'utf8').split('\n') }));

let failed = false;
const passed = [];
for (const { name, pattern, baseline, advice } of RATCHETS) {
  const hits = [];
  for (const { file, lines } of sources) {
    lines.forEach((line, i) => {
      if (pattern.test(line)) {
        hits.push({ file, line: i + 1, text: line.trim().slice(0, 90) });
      }
    });
  }

  if (hits.length > baseline) {
    failed = true;
    console.error(`✗ ${name}: rose to ${hits.length} (baseline ${baseline}).\n`);
    for (const h of hits) {
      console.error(`  ${h.file}:${h.line}`);
      console.error(`    ${h.text}`);
    }
    console.error('');
    for (const line of advice) {
      console.error(line);
    }
  } else if (hits.length < baseline) {
    failed = true;
    console.error(`✗ ${name}: fell to ${hits.length}, below the baseline of ${baseline}.`);
    console.error('');
    console.error(
      `Good — now lower that baseline to ${hits.length} in scripts/check-type-scale.mjs`
    );
    console.error('so the ratchet holds the ground you just took.');
  } else {
    passed.push(`${hits.length} ${name}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`check:type-scale passed — ${passed.join(', ')}, at the baseline`);
