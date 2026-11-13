#!/usr/bin/env node
/**
 * Every ink token clears 4.5:1 on the ground it is drawn on, in both themes.
 *
 * `--text-tertiary` shipped at 3.0:1 in light and 4.0:1 in dark and was the
 * foreground of 1,398 of the 1,723 contrast failures measured across the app
 * on 2026-11-12: the reassurance lines on the pay and sign-in screens, every
 * section label, most empty states. The status colours had the same defect
 * (the light warning read 1.95:1 as text), and the always-dark marketing band
 * carried an ink that flips with the theme, so its heading was 1.1:1 in dark.
 * Each was one line in src/app/globals.css that nothing measured.
 *
 * This reads the two theme blocks of globals.css, resolves every var(), and
 * computes the WCAG ratio for each pair below. A token change that drops a
 * pair under the floor fails here, before a browser is opened.
 *
 * `--text-muted` is absent on purpose: it paints dots and hairlines, not copy.
 *
 * Run: node scripts/check-token-contrast.mjs   (wired into `pnpm run verify`)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const CSS = 'src/app/globals.css';
const AA_TEXT = 4.5;

const SURFACES = ['page', 'base', 'raised', 'overlay', 'modal', 'drawer'].map(s => `surface-${s}`);
const TEXT = ['text-primary', 'text-secondary', 'text-tertiary'];
const STATUS = ['status-positive', 'status-warning', 'status-negative'];
/** A tinted chip sits on a page, a card or a raised panel. */
const TINT_GROUNDS = ['surface-page', 'surface-base', 'surface-raised'];

/** [ink, ground, tint laid over the ground first: a token, or [token, alpha]]. */
const PAIRS = [
  ...[...TEXT, ...STATUS, 'status-neutral'].flatMap(ink => SURFACES.map(s => [ink, s])),
  ...STATUS.flatMap(ink => TINT_GROUNDS.map(s => [ink, s, `${ink}-subtle`])),
  // Fills (what `bg-status-*` paints) and the ink each one carries.
  ['text-inverted', 'status-positive-fill'],
  ['text-inverted', 'status-negative-fill'],
  ['warning-foreground', 'status-warning-fill'],
  // The primary button, at rest and hovered.
  ['text-inverted', 'text-primary'],
  ['text-inverted', 'muted-strong'],
  ['on-accent', 'accent-primary'],
  ['on-accent', 'accent-hover'],
  ['on-public', 'surface-public'],
  ['primary-foreground', 'primary'],
  ['destructive-foreground', 'status-negative-fill'],
  ['success-foreground', 'status-positive-fill'],
  // Bitcoin orange as words: on every surface, and on the bitcoinOrange/10
  // chip (RecommendedWalletCard, ProfileWalletSection, WalletsStep).
  ...SURFACES.map(s => ['bitcoin-orange-text', s]),
  ...TINT_GROUNDS.map(s => ['bitcoin-orange-text', s, ['bitcoin-orange', 0.1]]),
];

/** The custom properties of one rule. Comments go first: a brace inside one
    would otherwise end the block early and leave a theme half-read. */
function block(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) {
    throw new Error(`${CSS}: no "${selector} {" block`);
  }
  let depth = 0;
  let end = -1;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') {
      depth++;
    } else if (css[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    throw new Error(`${CSS}: "${selector} {" is never closed`);
  }
  const vars = {};
  for (const [, name, value] of css.slice(start, end).matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    vars[name] = value.trim();
  }
  return vars;
}

/** → [r, g, b, alpha], channels 0..1. Follows var() until it reaches a colour. */
function colour(vars, name, seen = []) {
  const raw = vars[name];
  if (raw === undefined || seen.includes(name)) {
    throw new Error(`${CSS}: --${name} is not a colour this check can read`);
  }
  const ref = raw.match(/^var\(--([\w-]+)\)$/);
  if (ref) {
    return colour(vars, ref[1], [...seen, name]);
  }
  const hex = raw.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16) / 255).concat(1);
  }
  const hsl = raw.match(/^([\d.]+) ([\d.]+)% ([\d.]+)%(?: \/ ([\d.]+))?$/);
  if (!hsl) {
    throw new Error(`${CSS}: --${name}: "${raw}" is neither "H S% L%" nor a hex`);
  }
  const [h, s, l] = [Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100];
  const a = s * Math.min(l, 1 - l);
  const channel = n => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4), hsl[4] === undefined ? 1 : Number(hsl[4])];
}

const over = (top, under) => top.slice(0, 3).map((v, i) => v * top[3] + under[i] * (1 - top[3]));

function luminance(rgb) {
  const [r, g, b] = rgb.map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(join(ROOT, CSS), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const light = block(css, ':root');
const darkOnly = block(css, '.dark');
// A dark block that was only half read would be measured with light values
// and pass. Every token this check holds has to be set by the dark theme itself.
const unset = [...TEXT, ...SURFACES, ...STATUS, 'bitcoin-orange-text'].filter(
  name => darkOnly[name] === undefined
);
if (unset.length > 0) {
  throw new Error(`${CSS}: the .dark block does not set ${unset.map(n => `--${n}`).join(', ')}`);
}
const themes = { light, dark: { ...light, ...darkOnly } };

const failures = [];
let lowest = { value: Infinity };
for (const [theme, vars] of Object.entries(themes)) {
  for (const [ink, ground, tint] of PAIRS) {
    const under = colour(vars, ground);
    const [tintName, alpha] = Array.isArray(tint) ? tint : [tint];
    const tintColour = tint ? colour(vars, tintName) : null;
    if (alpha !== undefined) {
      tintColour[3] = alpha;
    }
    const bg = tint ? over(tintColour, under) : under;
    const value = ratio(over(colour(vars, ink), bg), bg);
    const tintLabel = alpha === undefined ? tintName : `${tintName}/${alpha * 100}`;
    const label = `${theme}: --${ink} on --${tint ? `${tintLabel} over --` : ''}${ground}`;
    if (value < lowest.value) {
      lowest = { value, label };
    }
    if (value < AA_TEXT) {
      failures.push(`  ${value.toFixed(2)}:1  ${label}`);
    }
  }
}

/* A band that is dark in both themes needs ink that is light in both.
   text-fg-inverted flips, so on bg-surface-public it vanishes in dark. */
const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.mdx']);
function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (EXTENSIONS.has(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}
const flipped = walk(join(ROOT, 'src')).filter(file => {
  const text = readFileSync(file, 'utf8');
  return /\bbg-surface-public\b/.test(text) && /\bfg-inverted\b/.test(text);
});

if (failures.length > 0 || flipped.length > 0) {
  if (failures.length > 0) {
    console.error(
      `check:token-contrast — ${failures.length} pair(s) under ${AA_TEXT}:1 in ${CSS}:`
    );
    for (const f of failures) {
      console.error(f);
    }
    console.error('\nChange the token, not the caller: every screen that uses it is failing.');
  }
  if (flipped.length > 0) {
    console.error('\ncheck:token-contrast — a file draws bg-surface-public and uses fg-inverted:');
    for (const f of flipped) {
      console.error(`  ${relative(ROOT, f)}`);
    }
    console.error('\nText on that band is text-on-public: the band is near-black in both themes');
    console.error('and fg-inverted turns near-black in dark. The check is per file, so if the');
    console.error('inverted ink belongs to something else, give the band its own component.');
  }
  process.exit(1);
}

console.log(
  `check:token-contrast passed — ${PAIRS.length * 2} pairs at ${AA_TEXT}:1 or better; ` +
    `the tightest is ${lowest.value.toFixed(2)}:1 (${lowest.label})`
);
