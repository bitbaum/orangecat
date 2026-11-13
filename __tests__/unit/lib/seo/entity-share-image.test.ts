/**
 * Every entity page's share image is the entity's own card
 * (/api/og/entity/[type]/[id]), not the generic site card — and the route
 * draws every type a page asks it for.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { SITE_ORIGIN } from '@/config/site-origin';
import { ENTITY_CARD_TYPES, isEntityCardType } from '@/lib/og/entity-card-data';
import { DEFAULT_SHARE_IMAGE, generateEntityMetadata } from '@/lib/seo/metadata';

type Images = Array<{ url: string; width: number; height: number; alt: string }>;
const imagesOf = (m: Metadata, key: 'openGraph' | 'twitter') =>
  (m[key] as { images?: Images } | undefined)?.images;

describe('generateEntityMetadata', () => {
  it.each(ENTITY_CARD_TYPES)('points a %s page at its own 1200×630 card', type => {
    const m = generateEntityMetadata({ type, id: 'abc-1', title: 'Old Road Bike' });
    const expected = [
      {
        url: `${SITE_ORIGIN}/api/og/entity/${type}/abc-1`,
        width: 1200,
        height: 630,
        alt: 'Old Road Bike',
      },
    ];
    expect(imagesOf(m, 'openGraph')).toEqual(expected);
    expect(imagesOf(m, 'twitter')).toEqual(expected);
    expect(JSON.stringify(m)).not.toContain(DEFAULT_SHARE_IMAGE);
    expect((m.twitter as { card?: string }).card).toBe('summary_large_image');
  });
});

describe('the entity pages', () => {
  const appDir = join(process.cwd(), 'src/app');
  const pages = readdirSync(appDir)
    .map(dir => join(appDir, dir, '[id]', 'page.tsx'))
    .filter(existsSync)
    .map(file => ({ file, source: readFileSync(file, 'utf8') }))
    .filter(({ source }) => source.includes('generateEntityMetadata('));

  it('exist', () => {
    expect(pages.length).toBeGreaterThanOrEqual(ENTITY_CARD_TYPES.length);
  });

  it('only ask for cards the route draws', () => {
    for (const { file, source } of pages) {
      const call = source.slice(source.indexOf('generateEntityMetadata('));
      const type = call.match(/type:\s*'([a-z_]+)'/)?.[1];
      expect(type, file).toBeDefined();
      expect(isEntityCardType(type as string), `${file}: ${type}`).toBe(true);
    }
  });
});
