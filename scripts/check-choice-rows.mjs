#!/usr/bin/env node
/**
 * A row of choices never wraps on its own terms.
 *
 * Pick-one rows and amount suggestions were built as pills in a
 * `flex flex-wrap` box, each as wide as its word, so on a phone they broke
 * wherever the words ran out: four on one line and one orphan on the next.
 * The owner found them one at a time and asked for the class of mistake to
 * stop ("Frankenstein elements … not sized, not symmetrical", 2026-10-19 on
 * Loki; the same words about OrangeCat's payment screens on 2026-10-21).
 *
 * The shapes that hold at any width (AGENTS.md → "One shape per kind, here"):
 *   • pick one of a few  → SegmentedControl: equal cells in one row
 *   • a few suggestions  → an even grid (`grid grid-cols-N`)
 *   • many filters       → one line that scrolls sideways
 *   • on/off settings    → one row each, in a list
 *
 * Heuristic, deliberately narrow: a wrapping container whose next lines hold
 * choices (aria-pressed, role="radio", role="tab"). Same shape as Loki's
 * scripts/test/choice-rows.ts, so the two repos fail on the same thing.
 *
 * Run: node scripts/check-choice-rows.mjs   (wired into `pnpm run verify`)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

/** Wrapping on purpose, and why. May shrink; never add a row of choices here. */
const ALLOWED = {};

function* tsx(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      yield* tsx(path);
    } else if (path.endsWith('.tsx')) {
      yield path;
    }
  }
}

const CHOICE = /aria-pressed=|role="radio"|role="tab"/;
const offenders = [];

for (const file of [...tsx(join(ROOT, 'src/components')), ...tsx(join(ROOT, 'src/app'))]) {
  const rel = relative(ROOT, file);
  if (ALLOWED[rel]) {
    continue;
  }
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!/className=["'`][^"'`]*\bflex-wrap\b/.test(line)) {
      return;
    }
    if (!/<div\b|<nav\b|<ul\b|<ol\b/.test(lines.slice(Math.max(0, i - 2), i + 1).join('\n'))) {
      return;
    }
    const body = lines.slice(i + 1, i + 14).join('\n');
    if (CHOICE.test(body)) {
      offenders.push(`${rel}:${i + 1}`);
    }
  });
}

if (offenders.length > 0) {
  console.error(
    `check:choice-rows — ${offenders.length} wrapping row(s) of choices. Use SegmentedControl, an even grid, or one scrolling line:`
  );
  for (const o of offenders) {
    console.error(`  ${o}`);
  }
  process.exit(1);
}
console.log('check:choice-rows — no wrapping rows of choices.');
