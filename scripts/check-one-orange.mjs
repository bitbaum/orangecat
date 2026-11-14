#!/usr/bin/env node
/**
 * One orange: it says Bitcoin, or it says the one action that brings a
 * visitor in. Nothing else is orange.
 *
 * The rule was written down long before it held. The 2026-11-12 audit
 * (systemic#11) still found the orange on settings tabs, focus rings, hover
 * states, AI sparkles and the Save button of half the signed-in editors —
 * and as text it is 2.0-2.3:1 on every light surface, so where it was words
 * it was also unreadable. Two sweeps cleared it; this keeps it cleared.
 *
 * Two ratchets:
 *
 * 1. `variant="accent"` under src/app/(authenticated). A signed-in page has
 *    no visitor to bring in; its actions are `primary`. (A component shared
 *    with public pages decides per call site — the signed-out sign-up button
 *    stays accent — so components are not counted.)
 * 2. `text-` / `border-` / `ring-accent-warm` anywhere in src. The orange as
 *    ink, outline or focus ring is decoration by definition: Bitcoin glyphs
 *    use `text-bitcoinOrange`, and the accent action is a FILL
 *    (`bg-accent-warm` with `text-on-accent`), which this does not count.
 *
 * Like check:type-scale this is a RATCHET: the count may fall or hold, never
 * rise. Lower a baseline in the same commit that removes an instance.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';

const ROOT = process.cwd();
const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.mdx']);
const AUTHENTICATED = join('src', 'app', '(authenticated)') + sep;

/** Lower a baseline when you remove instances. Never raise one. */
const RATCHETS = [
  {
    name: 'accent buttons on signed-in pages',
    pattern: /variant=["'{]+accent\b/,
    scope: file => file.startsWith(AUTHENTICATED),
    // 0 after the 2026-11-13 sweep (systemic#11).
    baseline: 0,
    advice: [
      'A signed-in page has no visitor to bring in: use variant="primary".',
      'The accent is for Bitcoin and the one public sign-up action.',
    ],
  },
  {
    name: 'orange ink, borders and rings (text|border|ring-accent-warm)',
    pattern: /\b(?:text|border|ring)-accent-warm\b/,
    scope: () => true,
    // 0 after the 2026-11-13 sweep (systemic#11).
    baseline: 0,
    advice: [
      'Words, outlines and focus rings take the ink tokens: text-fg-primary,',
      'text-fg-secondary, border-fg-primary, focus:ring-ring. A Bitcoin glyph',
      'is text-bitcoinOrange; the accent action is the Button "accent" variant.',
    ],
  },
];

function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {continue;}
      out = out.concat(walk(full));
    } else if (EXTENSIONS.has(extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

const sources = walk(join(ROOT, 'src')).map(full => ({
  file: relative(ROOT, full),
  lines: readFileSync(full, 'utf8').split('\n'),
}));

let failed = false;
const passed = [];
for (const { name, pattern, scope, baseline, advice } of RATCHETS) {
  const hits = [];
  for (const { file, lines } of sources) {
    if (!scope(file)) {continue;}
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
      `Good — now lower that baseline to ${hits.length} in scripts/check-one-orange.mjs`
    );
    console.error('so the ratchet holds the ground you just took.');
  } else {
    passed.push(`${hits.length} ${name}`);
  }
}

// 3. Bot faces. Their pigments are hex (the face is served as an SVG picture,
//    where a CSS variable does not resolve), so the two ratchets above cannot
//    see them: `orange` and `amber` sat in the list and the public bots wore
//    the brand's colour (agents#14). Not a ratchet: no pigment may be orange.
const FACES_FILE = join('src', 'config', 'companion-avatars.ts');
const facesSource = readFileSync(join(ROOT, FACES_FILE), 'utf8');
const huesBlock = /export const AVATAR_HUES[^=]*=\s*\[([\s\S]*?)\]/.exec(facesSource)?.[1];
if (!huesBlock) {
  failed = true;
  console.error(`✗ bot faces: AVATAR_HUES not found in ${FACES_FILE}; update this check.`);
} else {
  const pigments = [...huesBlock.matchAll(/#[0-9a-fA-F]{6}\b/g)].map(m => m[0]);
  const orange = pigments.filter(isOrange);
  if (pigments.length === 0) {
    failed = true;
    console.error(`✗ bot faces: no pigments read from ${FACES_FILE}; update this check.`);
  } else if (orange.length > 0) {
    failed = true;
    console.error(`✗ bot faces: ${orange.join(', ')} in ${FACES_FILE} is orange.\n`);
    console.error('Orange says Bitcoin or the one action that brings a visitor in.');
    console.error('A bot is neither: give the face another pigment.');
  } else {
    passed.push(`0 orange bot-face pigments of ${pigments.length}`);
  }
}

/**
 * Orange as an eye reads it: a hue between red-orange and amber that is both
 * saturated and light. Brown (the same hue, dark) is not orange.
 */
function isOrange(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) {return false;}
  const lightness = (max + min) / 2;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (max === r) {hue = ((g - b) / delta) % 6;}
  else if (max === g) {hue = (b - r) / delta + 2;}
  else {hue = (r - g) / delta + 4;}
  hue = (hue * 60 + 360) % 360;
  return hue >= 12 && hue <= 48 && saturation >= 0.6 && lightness >= 0.42;
}

if (failed) {
  process.exit(1);
}

console.log(`check:one-orange passed — ${passed.join(', ')}, at the baseline`);
