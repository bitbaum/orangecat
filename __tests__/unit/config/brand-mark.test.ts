/**
 * One mark per product, every asset generated from it — enforced.
 *
 * On 2026-10-11 OrangeCat had three marks in production: a cat face in the
 * header, a "window with ears" on every share card, and — where favicon.ico
 * should have been — a 155 KB fav.farm HTML page served as image/x-icon. The
 * PWA's 144px icon was one byte. Nothing generated those files, so nothing
 * noticed.
 *
 * Now every mark is a file in src/config/marks/, `pnpm run brand:import`
 * replaces one from an SVG, `pnpm run generate:brand` writes the static
 * icons from the brand's, and this test fails when any of that drifts:
 * a mark file missing from the registry, a hand-edited SVG, an icon not
 * regenerated after the mark changed, or an HTML page where an image belongs.
 *
 * Nothing here is specific to the current drawing, so replacing the mark
 * never means rewriting this test.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { APP_NAME, APP_DESCRIPTION, BRAND_ACCENT_HEX, APP_SLUG } from '@/config/brand';
import { BRAND_MARK } from '@/config/brand-mark';
import { MARKS, markFor } from '@/config/marks';
import { CAT_COIL, catCoilPathD } from '@/config/marks/generators/cat-coil';
import type { MarkDefinition } from '@/config/marks/types';
import { iconSvg } from '@/lib/brand/mark-svg';

const ROOT = join(__dirname, '../../..');
const read = (rel: string) => readFileSync(join(ROOT, rel));

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ICO_SIGNATURE = Buffer.from([0x00, 0x00, 0x01, 0x00]);

const marks = Object.entries(MARKS) as Array<[string, MarkDefinition]>;

describe('the mark registry', () => {
  it('lists every mark file in src/config/marks/, and nothing else', () => {
    const files = readdirSync(join(ROOT, 'src/config/marks'))
      .filter(name => name.endsWith('.ts') && name !== 'index.ts' && name !== 'types.ts')
      .map(name => name.slice(0, -3))
      .sort();
    expect(Object.keys(MARKS).sort()).toEqual(files);
  });

  it.each(marks)('%s is filed under its own slug', (key, mark) => {
    expect(mark.slug).toBe(key);
    expect(markFor(key)).toBe(mark);
  });

  it.each(marks)('%s is drawable', (_key, mark) => {
    expect(mark.viewBox).toHaveLength(4);
    expect(mark.viewBox.every(Number.isFinite)).toBe(true);
    expect(mark.viewBox[2]).toBeGreaterThan(0);
    expect(mark.viewBox[3]).toBeGreaterThan(0);
    expect(mark.strokeWidth).toBeGreaterThan(0);
    expect(mark.shapes.length).toBeGreaterThan(0);
    for (const shape of mark.shapes) {
      expect(shape.d).toMatch(/^\s*[Mm]/);
      expect(shape.d).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/);
    }
  });

  it('has a mark for this app, and it is the brand mark', () => {
    expect(markFor(APP_SLUG)).toBe(BRAND_MARK);
  });

  it('returns null for a project without a mark', () => {
    expect(markFor('no-such-project')).toBeNull();
  });
});

describe('the static brand assets are generated from the brand mark', () => {
  it.each(['public/favicon.svg', 'public/images/orange-cat-logo.svg'])(
    '%s is exactly the icon tile — run `pnpm run generate:brand` if this fails',
    rel => {
      expect(read(rel).toString('utf8')).toBe(`${iconSvg(BRAND_MARK)}\n`);
    }
  );

  it('favicon.ico is an icon container with 16, 32 and 48px PNG entries — not an HTML page', () => {
    const ico = read('public/favicon.ico');
    expect(ico.subarray(0, 4).equals(ICO_SIGNATURE)).toBe(true);
    const count = ico.readUInt16LE(4);
    expect(count).toBe(3);
    const sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const entry = 6 + i * 16;
      sizes.push(ico.readUInt8(entry));
      const offset = ico.readUInt32LE(entry + 12);
      expect(ico.subarray(offset, offset + 8).equals(PNG_SIGNATURE)).toBe(true);
    }
    expect(sizes).toEqual([16, 32, 48]);
  });

  it.each([
    'public/apple-icon.png',
    'public/icons/icon-192.png',
    'public/icons/icon-512.png',
    'public/icons/icon-512-maskable.png',
  ])('%s is a real PNG', rel => {
    const png = read(rel);
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(png.length).toBeGreaterThan(1_000);
  });

  it('the manifest points only at files that exist and are images', () => {
    const manifest = JSON.parse(read('public/manifest.json').toString('utf8')) as {
      icons: Array<{ src: string; type: string }>;
    };
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      const rel = join('public', icon.src.split('?')[0]);
      expect(existsSync(join(ROOT, rel))).toBe(true);
      const bytes = read(rel);
      if (icon.type === 'image/png') {
        expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
      } else {
        expect(bytes.toString('utf8').startsWith('<svg')).toBe(true);
      }
    }
  });
});

describe('the cat coil generator', () => {
  const coords = catCoilPathD().replace(/[ML]/g, '').trim().split(/\s+/).map(Number);

  it('is one continuous stroke inside its box, stroke included', () => {
    expect(catCoilPathD().match(/M/g)).toHaveLength(1);
    const margin = CAT_COIL.strokeWidth / 2;
    for (const value of coords) {
      expect(value).toBeGreaterThanOrEqual(margin);
      expect(value).toBeLessThanOrEqual(CAT_COIL.viewBox - margin);
    }
  });

  it('wears both ears at the same height, mirrored about the centre', () => {
    let left = { x: 0, y: Infinity };
    let right = { x: 0, y: Infinity };
    for (let i = 0; i < coords.length; i += 2) {
      const [x, y] = [coords[i], coords[i + 1]];
      if (x < CAT_COIL.cx && y < left.y) left = { x, y };
      if (x > CAT_COIL.cx && y < right.y) right = { x, y };
    }
    expect(Math.abs(left.y - right.y)).toBeLessThan(0.5);
    expect(Math.abs(CAT_COIL.cx - left.x - (right.x - CAT_COIL.cx))).toBeLessThan(0.5);
  });
});

describe('installed brand freshness', () => {
  it('versions every install icon from the canonical mark and uses brand metadata', () => {
    const manifest = JSON.parse(read('public/manifest.json').toString());
    const version = createHash('sha256')
      .update(iconSvg(BRAND_MARK) + iconSvg(BRAND_MARK, { maskable: true }))
      .digest('hex')
      .slice(0, 12);
    expect(manifest.short_name).toBe(APP_NAME);
    expect(manifest.description).toBe(APP_DESCRIPTION);
    expect(manifest.theme_color).toBe(BRAND_ACCENT_HEX);
    for (const icon of manifest.icons) expect(icon.src).toContain(`?v=${version}`);
    const assets = JSON.parse(read('src/config/brand-assets.json').toString());
    for (const url of Object.values(assets)) expect(url).toContain(`?v=${version}`);
  });
});

it.each([
  ['public/apple-icon.png', 180],
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512],
  ['public/icons/icon-512-maskable.png', 512],
] as const)('%s has a visible mark at its declared size', async (file, size) => {
  const { default: sharp } = await import('sharp');
  const image = sharp(read(file));
  const metadata = await image.metadata();
  expect([metadata.width, metadata.height]).toEqual([size, size]);
  // Compare the shipped raster to an independent render of the canonical SVG.
  // Allow renderer antialiasing differences, but reject an old or blank logo.
  const actual = await image.clone().ensureAlpha().raw().toBuffer();
  const expected = await sharp(
    Buffer.from(iconSvg(BRAND_MARK, { maskable: file.includes('maskable') }))
  )
    .resize(size, size)
    .ensureAlpha()
    .raw()
    .toBuffer();
  let difference = 0;
  for (let index = 0; index < actual.length; index++) {
    difference += Math.abs(actual[index] - expected[index]);
  }
  expect(difference / actual.length).toBeLessThan(4);
  const { channels } = await image.stats();
  for (const channel of channels.slice(0, 3)) {
    expect(channel.max).toBeGreaterThan(200);
    expect(channel.mean).toBeGreaterThan(15);
    expect(channel.mean).toBeLessThan(200);
  }
});
