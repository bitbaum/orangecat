#!/usr/bin/env node
/**
 * Replace (or add) a product's mark from an SVG file.
 *
 *   pnpm run brand:import <slug> <file.svg> [--name "Display name"] [--motion draw|spin|none]
 *   pnpm run brand:import --index        rebuild the registry only
 *
 * What it does:
 *   1. Reads the SVG and converts it to a mark (src/lib/brand/svg-to-mark.ts):
 *      geometry kept, colours dropped, background rectangle dropped. Anything
 *      it cannot convert faithfully stops it with a message saying what to do.
 *   2. Writes src/config/marks/<slug>.ts — replacing the old mark, if any.
 *   3. Rebuilds src/config/marks/index.ts from the files in that folder.
 *   4. If <slug> is this app's own (orangecat), regenerates every static icon
 *      (favicon.svg, favicon.ico, apple-icon.png, PWA icons) to match.
 *
 * Then commit what changed. The header, the hero, share cards and every
 * studio tile render from the registry, so nothing else needs editing.
 *
 * <slug> is the project's fleet slug (as on loki.orangecat.ch/api/fleet/map):
 * a mark for "heidi" makes Heidi's studio tile show it instead of an "H".
 */

import './lib/register-ts.mjs';

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARKS_DIR = join(ROOT, 'src/config/marks');
const NOT_MARKS = new Set(['index.ts', 'types.ts']);

const { APP_SLUG } = await import('../src/config/brand.ts');
const { svgToMark, MarkImportError } = await import('../src/lib/brand/svg-to-mark.ts');
const { markModuleSource, marksIndexSource } = await import('../src/lib/brand/mark-sources.ts');

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function option(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Format with the repo's Prettier when it is installed; the output is already close. */
async function format(path) {
  try {
    const prettier = await import('prettier');
    const config = (await prettier.resolveConfig(path)) ?? {};
    const source = readFileSync(path, 'utf8');
    writeFileSync(path, await prettier.format(source, { ...config, filepath: path }));
  } catch {
    // Prettier absent — the file is valid TypeScript as written.
  }
}

async function writeIndex() {
  const slugs = readdirSync(MARKS_DIR)
    .filter(name => name.endsWith('.ts') && !NOT_MARKS.has(name))
    .map(name => name.slice(0, -'.ts'.length));
  const path = join(MARKS_DIR, 'index.ts');
  writeFileSync(path, marksIndexSource(slugs));
  await format(path);
  console.log(`wrote src/config/marks/index.ts (${slugs.length} marks: ${slugs.join(', ')})`);
}

const args = process.argv.slice(2).filter((arg, i, all) => {
  if (arg.startsWith('--')) {
    return false;
  }
  const previous = all[i - 1];
  return !(previous === '--name' || previous === '--motion');
});

if (process.argv.includes('--index')) {
  await writeIndex();
  process.exit(0);
}

const [slug, file] = args;
if (!slug || !file) {
  fail('usage: pnpm run brand:import <slug> <file.svg> [--name "Name"] [--motion draw|spin|none]');
}
if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  fail(`"${slug}" is not a fleet slug — lowercase letters, digits and dashes`);
}

const motion = option('motion') ?? 'draw';
if (!['draw', 'spin', 'none'].includes(motion)) {
  fail(`--motion must be draw, spin or none (got "${motion}")`);
}

let svg;
try {
  svg = readFileSync(file, 'utf8');
} catch (error) {
  fail(`cannot read ${file}: ${error.message}`);
}

let geometry;
try {
  geometry = svgToMark(svg);
} catch (error) {
  if (error instanceof MarkImportError) {
    fail(`${basename(file)}: ${error.message}`);
  }
  throw error;
}

const name =
  option('name') ??
  slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const mark = {
  slug,
  name,
  source: `imported — ${basename(file)}`,
  motion,
  viewBox: geometry.viewBox,
  strokeWidth: geometry.strokeWidth,
  shapes: geometry.shapes,
};

const modulePath = join(MARKS_DIR, `${slug}.ts`);
writeFileSync(
  modulePath,
  markModuleSource(mark, { file: basename(file), date: new Date().toISOString().slice(0, 10) })
);
await format(modulePath);
console.log(
  `wrote src/config/marks/${slug}.ts (${mark.shapes.length} shapes, viewBox ${mark.viewBox.join(' ')})`
);
for (const warning of geometry.warnings) {
  console.warn(`  ! ${warning}`);
}

await writeIndex();

if (slug === APP_SLUG) {
  console.log(`\n${slug} is this app's own mark — regenerating the static icons…`);
  const result = spawnSync(
    process.execPath,
    ['--no-warnings', join(ROOT, 'scripts/generate-brand.mjs')],
    { stdio: 'inherit', env: process.env }
  );
  if (result.status !== 0) {
    fail(
      'the mark was imported, but the icons were not regenerated: run `pnpm run generate:brand`'
    );
  }
}

console.log('\nDone. Commit the changed files; every surface renders from the registry.');
