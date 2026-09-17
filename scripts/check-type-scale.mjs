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
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Lower this when you remove instances. Never raise it.
 *
 * 14 → 13 on 2026-08-29: the timeline's post body moved from `text-[15px]` to
 * the named `text-post` token.
 */
const BASELINE = 12;

const ARBITRARY_SIZE = /\btext-\[[0-9]/;

const files = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx"', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const hits = [];
for (const file of files) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (ARBITRARY_SIZE.test(line)) {
        hits.push({ file, line: i + 1, text: line.trim().slice(0, 90) });
      }
    });
}

if (hits.length > BASELINE) {
  console.error(
    `✗ Arbitrary font sizes rose to ${hits.length} (baseline ${BASELINE}).\n`
  );
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}`);
    console.error(`    ${h.text}`);
  }
  console.error('');
  console.error('Use a size from the scale in tailwind.config.ts, or add a NAMED one');
  console.error('there if the size is a real decision (as `post` = 15px is).');
  console.error('An arbitrary value is unreachable by theming and invisible to audits.');
  process.exit(1);
}

if (hits.length < BASELINE) {
  console.error(
    `✗ Arbitrary font sizes fell to ${hits.length}, below the baseline of ${BASELINE}.`
  );
  console.error('');
  console.error(`Good — now lower BASELINE to ${hits.length} in scripts/check-type-scale.mjs`);
  console.error('so the ratchet holds the ground you just took.');
  process.exit(1);
}

console.log(`check:type-scale passed — ${hits.length} arbitrary font sizes, at the baseline`);
