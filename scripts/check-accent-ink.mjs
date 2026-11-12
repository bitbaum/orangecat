#!/usr/bin/env node
/**
 * White ink on the warm accent is 3.10:1 — below the 4.5:1 AA floor. The
 * paired ink for that fill is text-on-accent (see --on-accent in globals.css).
 * This class of bug shipped twice (PR #703 swept 13 files; three stragglers
 * survived in a cva variant and two inline chips), so the class is now closed
 * by a gate instead of a third sweep.
 *
 * One orange: --public-accent IS --bitcoin-orange, so `bg-bitcoinOrange` is the
 * same fill under its Bitcoin name. The gate read only `bg-accent-warm`, and
 * ten white-on-orange labels — the pay card's "Open in wallet", every wallet's
 * "Send with Wallet" — passed it at 2.30:1. Only the solid fill counts: a tint
 * such as `bg-bitcoinOrange/10` takes ordinary ink.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.mdx']);
const PAIR =
  /(?:bg-accent-warm|bg-bitcoinOrange(?![\w/]))[^"'`]*text-white\b|text-white\b[^"'`]*(?:bg-accent-warm|bg-bitcoinOrange(?![\w/]))/;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXTENSIONS.has(extname(entry.name))) files.push(full);
  }
  return files;
}

const violations = [];
for (const file of walk(join(ROOT, 'src'))) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (PAIR.test(line)) {
        violations.push(`${relative(ROOT, file)}:${i + 1}\n  ${line.trim()}`);
      }
    });
}

if (violations.length > 0) {
  console.error(
    `check:accent-ink — ${violations.length} white-on-accent label(s). Use text-on-accent:`
  );
  for (const v of violations) console.error(v);
  process.exit(1);
}
console.log('check:accent-ink passed — no white ink on the warm accent.');
