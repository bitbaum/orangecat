#!/usr/bin/env node
/**
 * Ink rules: which colour words may be, given what they sit on.
 *
 * White ink on the orange is 2.30:1 — below the 4.5:1 AA floor. The paired
 * ink for that fill is text-on-accent (8.02:1; see --on-accent in
 * globals.css). This class of bug shipped twice (PR #703 swept 13 files; three
 * stragglers survived in a cva variant and two inline chips), so the class was
 * closed by a gate instead of a third sweep. It then shipped a third time,
 * because the gate knew one spelling of one pair: the same orange under its
 * other name (`bg-bitcoinOrange`) and the same white under its other name
 * (`text-fg-inverted` is 98% white in light) both passed, on eleven lines
 * including the button that opens the payer's wallet. So the gate now states
 * the rules, not one instance of them:
 *
 * 1. An orange fill takes text-on-accent, under either name of the orange.
 * 2. A fill that flips with the theme never takes text-white. `bg-fg-primary`
 *    is near-white in dark, so white on it is 1.19:1; the GRADIENTS keys
 *    resolve to that fill and carry their own ink.
 * 3. A status fill never takes text-white (2.2:1 on the dark positive). The
 *    positive and negative fills take text-fg-inverted; the warning fill is
 *    amber in both themes and takes text-warning-foreground.
 * 4. Words are not dimmed. `text-fg-muted` is under 3:1 on every surface and
 *    is for marks, never copy; an alpha on a text or status colour takes copy
 *    that passed below 4.5:1 (an error message at /80 is 3.28:1). A hover or
 *    focus state may dim, and so may an icon: a self-closing element holds no
 *    words.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.mdx']);

/** Both classes inside one string: a fill and the ink written next to it. */
const inOneString = (a, b) => new RegExp(`${a}[^"'\`]*${b}|${b}[^"'\`]*${a}`);
/** Both on one line: a fill constant and an ink class appended beside it. */
const onOneLine = (a, b) => new RegExp(`${a}.*${b}|${b}.*${a}`);

// The solid fill only: a tint such as bg-bitcoinOrange/10 takes ordinary ink.
const ORANGE_FILL = String.raw`(?<![\w:-])bg-(?:accent-warm|bitcoinOrange)(?![\w/-])`;
const LIGHT_INK = String.raw`\btext-(?:white|fg-inverted|primary-foreground)\b`;
const FLIPPING_FILL = String.raw`(?:GRADIENTS\.|iconGradient|bg-fg-primary|bg-foreground|bg-primary\b)`;
const STATUS_FILL = String.raw`bg-status-(?:positive|negative|warning|neutral)(?![\w/-])`;
const WHITE_INK = String.raw`\btext-white\b`;
const ACCENT_VARIANT = String.raw`variant=["']accent["']`;
const WARNING_FILL = String.raw`bg-status-warning(?![\w/-])`;

const DIMMED =
  /((?:[^\s"'`:]+:)*)text-(?:fg-(?:secondary|tertiary)|status-(?:positive|negative|warning|neutral))\/\d+/g;
const STATE_VARIANT = /hover|focus|active|disabled/;
const ICON_ONLY = /^\s*<[A-Z][\w.]*\s[^<>]*\/>\s*$/;

function hasDimmedCopy(line) {
  if (ICON_ONLY.test(line)) {
    return false;
  }
  return [...line.matchAll(DIMMED)].some(([, variants]) => !STATE_VARIANT.test(variants));
}

const RULES = [
  {
    name: 'light ink on the orange',
    fix: 'Use text-on-accent.',
    test: line =>
      inOneString(ORANGE_FILL, LIGHT_INK).test(line) ||
      onOneLine(ACCENT_VARIANT, LIGHT_INK).test(line),
    acrossCall: call => onOneLine(ORANGE_FILL, LIGHT_INK).test(call),
  },
  {
    name: 'white ink on a fill that flips with the theme',
    fix: 'Use text-fg-inverted; a GRADIENTS key already carries it, so add no ink beside one.',
    test: line => onOneLine(FLIPPING_FILL, WHITE_INK).test(line),
  },
  {
    name: 'white ink on a status fill',
    fix: 'Use text-fg-inverted (text-warning-foreground on the warning fill).',
    test: line => inOneString(STATUS_FILL, WHITE_INK).test(line),
    acrossCall: call => onOneLine(STATUS_FILL, WHITE_INK).test(call),
  },
  {
    name: 'flipping ink on the warning fill',
    fix: 'The warning fill is amber in both themes. Use text-warning-foreground.',
    test: line => inOneString(WARNING_FILL, String.raw`\btext-fg-inverted\b`).test(line),
  },
  {
    name: 'an accent class that draws nothing',
    fix: 'There is no accent-primary utility. Selection inside the app is ink (text-fg-primary, border-fg-primary); the orange is accent-warm.',
    test: line =>
      /\b(?:bg|text|border|ring|divide|fill|stroke|outline|decoration)-accent-primary\b/.test(line),
  },
  {
    name: 'dimmed copy',
    fix: 'Use text-fg-tertiary for the quietest words, and drop the /NN from a resting text or status colour.',
    test: line => /text-fg-muted\b/.test(line) || hasDimmedCopy(line),
  },
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (EXTENSIONS.has(extname(entry.name))) files.push(full);
  }
  return files;
}

/**
 * Each cn() / clsx() / cva() / twMerge() call that spans several lines, as one
 * line. A fill and its ink are often two arguments of one call, which the
 * line-by-line pass below cannot see.
 */
function* multiLineCalls(source) {
  for (const open of source.matchAll(/\b(?:cn|clsx|cva|twMerge)\(/g)) {
    let depth = 0;
    for (let i = open.index + open[0].length - 1; i < source.length; i++) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')' && --depth === 0) {
        const text = source.slice(open.index, i + 1);
        if (text.includes('\n')) {
          yield { line: source.slice(0, open.index).split('\n').length, text };
        }
        break;
      }
    }
  }
}

const violations = new Map(RULES.map(rule => [rule, []]));
for (const file of walk(join(ROOT, 'src'))) {
  const source = readFileSync(file, 'utf8');
  source.split('\n').forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.test(line)) {
        violations.get(rule).push(`${relative(ROOT, file)}:${i + 1}\n  ${line.trim()}`);
      }
    }
  });
  for (const call of multiLineCalls(source)) {
    const flat = call.text.replace(/\s+/g, ' ');
    for (const rule of RULES) {
      if (rule.acrossCall?.(flat)) {
        violations.get(rule).push(`${relative(ROOT, file)}:${call.line}\n  ${flat.slice(0, 140)}`);
      }
    }
  }
}

const total = [...violations.values()].reduce((sum, hits) => sum + hits.length, 0);
if (total > 0) {
  console.error(`check:accent-ink — ${total} line(s) put words in an ink that cannot be read.`);
  for (const [rule, hits] of violations) {
    if (hits.length > 0) {
      console.error(`\n${hits.length} × ${rule.name}. ${rule.fix}\n${hits.join('\n')}`);
    }
  }
  process.exit(1);
}
console.log(
  'check:accent-ink passed — no light ink on the orange, no white on a flipping or status fill, no dimmed copy.'
);
