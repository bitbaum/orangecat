#!/usr/bin/env node
/**
 * A hand-built link or button that sets its own height keeps 44px on touch.
 *
 * `globals.css` gives every <a> a 44px minimum height, and Button and
 * TabsTrigger add `pointer-coarse:min-h-11` themselves. A class that writes
 * `min-h-9` on a raw <a>, <Link>, <button> or <summary> lowers that floor for
 * every pointer, fingers included.
 *
 * Measured at 390px with a touch pointer on 2026-11-12: 1,438 targets under
 * 44px across 99 pages. 1,050 of them came from one constant, the footer's
 * `min-h-9` link class; 114 more were `min-h-9` text links ("Start", "See
 * yours"). The same class had already been fixed once by hand (the header
 * logo, /auth and Discover's inline links), so this is the rule instead of a
 * third sweep:
 *
 *   a compact minimum height on a raw interactive element, or in a shared
 *   class constant, is paired in the same string with
 *   `pointer-coarse:min-h-11`. A desktop keeps its density; a finger gets 44px.
 *
 * What is not a hit: a variant-prefixed height (`sm:min-h-8` says the phone
 * uses something else), and a height passed to a component that carries its
 * own touch rule or is not a target at all (Button, TabsTrigger, a div).
 *
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

/** Zero since the icon button took its touch size. Never raise it. */
const BASELINE = 0;

const ROOT = process.cwd();
const EXTENSIONS = new Set(['.ts', '.tsx']);
// Any spacing step under 11 (44px), halves included, and a pixel value under 44.
// `min-h-0` is a flex reset, not a height.
const COMPACT_HEIGHT =
  /(?<![\w:-])min-h-(?:(?:10|[1-9])(?:\.5)?(?![\w.-])|\[(?:[1-9]|[1-3]\d|4[0-3])px\])/g;
const TOUCH_PAIR = 'pointer-coarse:min-h-11';
const RAW_TARGETS = new Set(['a', 'Link', 'button', 'summary', 'motion.a', 'motion.button']);
const OPENING_TAG = /<([A-Za-z][\w.]*)(?=[\s/>])/g;
/** A `>` that ends an opening tag, as opposed to the one in an arrow `=>`. */
const TAG_END = /(?<!=)>/;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXTENSIONS.has(extname(entry.name))) files.push(full);
  }
  return files;
}

/** The element whose opening tag the offset sits inside, or null in plain code. */
function enclosingTag(source, offset) {
  let tag = null;
  for (const match of source.slice(0, offset).matchAll(OPENING_TAG)) {
    tag = match;
  }
  if (!tag || TAG_END.test(source.slice(tag.index + tag[0].length, offset))) {
    return null;
  }
  return tag[1];
}

const hits = [];
for (const file of walk(join(ROOT, 'src'))) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(COMPACT_HEIGHT)) {
    const lineStart = source.lastIndexOf('\n', match.index) + 1;
    const lineEnd = source.indexOf('\n', match.index);
    const line = source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    if (line.includes(TOUCH_PAIR)) {
      continue;
    }
    const tag = enclosingTag(source, match.index);
    if (tag === null || RAW_TARGETS.has(tag)) {
      const lineNumber = source.slice(0, match.index).split('\n').length;
      hits.push(`${relative(ROOT, file)}:${lineNumber}\n  ${line.trim().slice(0, 110)}`);
    }
  }
}

if (hits.length > BASELINE) {
  console.error(
    `check:tap-targets — ${hits.length} compact heights with no 44px touch size (baseline ${BASELINE}).\n`
  );
  console.error(hits.join('\n'));
  console.error('');
  console.error(`Add ${TOUCH_PAIR} beside the compact min-h, in the same`);
  console.error('class string. Desktop keeps the compact height; a touch screen gets 44px.');
  process.exit(1);
}

if (hits.length < BASELINE) {
  console.error(`check:tap-targets — fell to ${hits.length}, below the baseline of ${BASELINE}.`);
  console.error('');
  console.error(`Good — now lower BASELINE to ${hits.length} in scripts/check-tap-targets.mjs`);
  console.error('so the ratchet holds the ground you just took.');
  process.exit(1);
}

console.log(
  `check:tap-targets passed — ${hits.length} compact height(s) without a touch size, at the baseline`
);
