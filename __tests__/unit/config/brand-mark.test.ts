/**
 * One mark, everywhere — enforced.
 *
 * On 2026-10-11 OrangeCat had three marks in production: a cat face in the
 * header, a "window with ears" on every share card, and — where favicon.ico
 * should have been — a 155 KB fav.farm HTML page served as image/x-icon, so
 * the tab icon had been broken in every browser that prefers .ico. The PWA's
 * 144px icon was one byte. Nothing generated those files, so nothing noticed.
 *
 * Now src/config/brand-mark.ts is the only geometry, `pnpm run generate:brand`
 * writes every static asset from it, and this test fails when any of them
 * drifts: a hand-edited SVG, a regenerated-but-not-committed icon, or another
 * HTML page where an image should be.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_MARK, brandMarkSvg, catCoilPathD } from '@/config/brand-mark';

const ROOT = join(__dirname, '../../..');
const read = (rel: string) => readFileSync(join(ROOT, rel));

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ICO_SIGNATURE = Buffer.from([0x00, 0x00, 0x01, 0x00]);

describe('the brand mark geometry', () => {
  const d = catCoilPathD();

  it('is one continuous stroke', () => {
    expect(d.startsWith('M')).toBe(true);
    expect(d.match(/M/g)).toHaveLength(1);
  });

  it('stays inside its viewBox, stroke included', () => {
    const margin = BRAND_MARK.strokeWidth / 2;
    const numbers = d.replace(/[ML]/g, '').trim().split(/\s+/).map(Number);
    for (const n of numbers) {
      expect(n).toBeGreaterThanOrEqual(margin);
      expect(n).toBeLessThanOrEqual(BRAND_MARK.viewBox - margin);
    }
  });

  it('wears both ears at the same height', () => {
    // The ear tips are the two points closest to the top edge, one on each
    // side of the centre. A coil whose radius grows along the turn would put
    // them at different heights — that was the first prototype's flaw.
    const points = d.replace(/[ML]/g, '').trim().split(/\s+/).map(Number);
    let left = { x: 0, y: Infinity };
    let right = { x: 0, y: Infinity };
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i];
      const y = points[i + 1];
      if (x < BRAND_MARK.cx && y < left.y) left = { x, y };
      if (x > BRAND_MARK.cx && y < right.y) right = { x, y };
    }
    expect(Math.abs(left.y - right.y)).toBeLessThan(1.5);
    expect(Math.abs(left.x - BRAND_MARK.cx)).toBeCloseTo(Math.abs(right.x - BRAND_MARK.cx), 0);
  });
});

describe('every static brand asset is generated from the SSOT', () => {
  const d = catCoilPathD();

  it.each(['public/favicon.svg', 'public/images/orange-cat-logo.svg'])(
    '%s carries the exact path',
    rel => {
      const svg = read(rel).toString('utf8');
      expect(svg).toContain(`d="${d}"`);
      expect(svg).toContain(`stroke-width="${BRAND_MARK.strokeWidth}"`);
    }
  );

  it('brandMarkSvg() emits the same path the assets carry', () => {
    expect(brandMarkSvg()).toContain(`d="${d}"`);
    expect(brandMarkSvg({ background: '#0a0a0a' })).toContain('<rect');
  });

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
      const rel = join('public', icon.src);
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
