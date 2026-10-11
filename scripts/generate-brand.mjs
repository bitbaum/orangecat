#!/usr/bin/env node
/**
 * Generate EVERY static brand asset from the one SSOT, src/config/brand-mark.ts
 * (which is src/config/marks/<APP_SLUG>.ts).
 *
 *   public/favicon.svg                 the mark on a dark rounded square (crisp source of truth)
 *   public/images/orange-cat-logo.svg  identical — the manifest and the service worker point here
 *   public/favicon.ico                 16 / 32 / 48 px, PNG-encoded ICO (every browser since Vista)
 *   public/apple-icon.png              180 px
 *   public/icons/icon-192.png          192 px, purpose "any"
 *   public/icons/icon-512.png          512 px, purpose "any"
 *   public/icons/icon-512-maskable.png 512 px, mark inset to the maskable safe zone
 *
 * Run: pnpm run generate:brand   (pnpm run brand:import runs it for you when
 * the mark it imports is this app's own)
 *
 * Why this exists: on 2026-10-11 public/favicon.ico was a 155 KB fav.farm HTML
 * page served as image/x-icon — the tab icon had been broken in every browser
 * that prefers .ico — and public/icons/icon-144x144.png was one byte long.
 * Nothing produced those files, so nothing could notice. Now one script
 * produces all of them and __tests__/unit/config/brand-mark.test.ts fails
 * when any of them stops matching the geometry.
 *
 * Rasterising uses the Chromium that @playwright/test already installs for the
 * e2e suite, so this adds no dependency. Node runs the .ts SSOT directly
 * (type stripping is on by default in the Node this repo pins).
 */

import './lib/register-ts.mjs';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Whatever mark src/config/marks/<APP_SLUG>.ts holds — generated or imported.
const { BRAND_MARK } = await import('../src/config/brand-mark.ts');
const { iconSvg } = await import('../src/lib/brand/mark-svg.ts');

const tileSvg = iconSvg(BRAND_MARK);
const maskableSvg = iconSvg(BRAND_MARK, { maskable: true });

function write(rel, data) {
  const out = join(ROOT, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, data);
  console.log(`wrote ${rel} (${data.length} bytes)`);
}

write('public/favicon.svg', `${tileSvg}\n`);
write('public/images/orange-cat-logo.svg', `${tileSvg}\n`);

async function loadChromium() {
  try {
    return (await import('@playwright/test')).chromium;
  } catch {
    // A sandbox without the repo's node_modules can point at any Playwright install.
    const alt = process.env.PLAYWRIGHT_MODULE;
    if (!alt) throw new Error('@playwright/test is not installed and PLAYWRIGHT_MODULE is not set');
    return (await import(pathToFileURL(alt).href)).chromium;
  }
}

const chromium = await loadChromium();
// A pre-installed Chromium (CI images, agent sandboxes) can be named instead of
// the one Playwright downloads.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch(executablePath ? { executablePath } : {});

/** Rasterise an SVG string to a size×size PNG buffer. */
async function png(svg, size) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const scaled = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${scaled}</body></html>`
  );
  const buffer = await page.screenshot({ type: 'png', omitBackground: true });
  await page.close();
  return buffer;
}

/** Pack PNG images into a .ico container (PNG entries are valid ICO since Windows Vista). */
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);
  const directory = Buffer.alloc(16 * entries.length);
  let offset = 6 + directory.length;
  entries.forEach(({ size, buffer }, i) => {
    const o = i * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, o); // width (0 means 256)
    directory.writeUInt8(size >= 256 ? 0 : size, o + 1); // height
    directory.writeUInt8(0, o + 2); // palette size
    directory.writeUInt8(0, o + 3); // reserved
    directory.writeUInt16LE(1, o + 4); // colour planes
    directory.writeUInt16LE(32, o + 6); // bits per pixel
    directory.writeUInt32LE(buffer.length, o + 8);
    directory.writeUInt32LE(offset, o + 12);
    offset += buffer.length;
  });
  return Buffer.concat([header, directory, ...entries.map(e => e.buffer)]);
}

const icoEntries = [];
for (const size of [16, 32, 48]) {
  icoEntries.push({ size, buffer: await png(tileSvg, size) });
}
write('public/favicon.ico', ico(icoEntries));
write('public/apple-icon.png', await png(tileSvg, 180));
write('public/icons/icon-192.png', await png(tileSvg, 192));
write('public/icons/icon-512.png', await png(tileSvg, 512));
write('public/icons/icon-512-maskable.png', await png(maskableSvg, 512));

await browser.close();
