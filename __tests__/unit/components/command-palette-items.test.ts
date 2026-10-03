import { describe, expect, it } from 'vitest';
import {
  buildCreateItems,
  buildPages,
  rankItems,
  thingItems,
} from '@/components/search/command-palette-items';
import { ENTITY_REGISTRY, ENTITY_TYPES } from '@/config/entity-registry';
import type { Thing } from '@/domain/things/service';

// The palette's lists are derived, so a new entity type or sidebar page shows
// up without anyone remembering a second, hand-typed list (there were two).
describe('command palette items', () => {
  it('offers to create every entity type, in its plain words', () => {
    const creates = buildCreateItems();
    expect(creates).toHaveLength(ENTITY_TYPES.length);
    expect(creates.map(c => c.href)).toEqual(ENTITY_TYPES.map(t => ENTITY_REGISTRY[t].createPath));
  });

  it('can jump to every type list and every sidebar page, once each', () => {
    const pages = buildPages();
    const hrefs = pages.map(p => p.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const t of ENTITY_TYPES) {
      expect(hrefs).toContain(ENTITY_REGISTRY[t].basePath);
    }
  });

  it('finds your own things by any word, accents folded, best match first', () => {
    const things: Thing[] = [
      {
        type: 'event',
        id: '1',
        title: 'Bitcoin Meetup Zürich',
        status: 'draft',
        createdAt: null,
        href: '/e/1',
      },
      {
        type: 'asset',
        id: '2',
        title: 'Studio near Zurich lake',
        status: null,
        createdAt: null,
        href: '/a/2',
      },
      {
        type: 'loan',
        id: '3',
        title: 'Fix my velo',
        status: 'active',
        createdAt: null,
        href: '/l/3',
      },
    ];
    const found = rankItems(thingItems(things), 'zurich meetup', 5).map(i => i.label);
    expect(found).toEqual(['Bitcoin Meetup Zürich']);
    expect(rankItems(thingItems(things), 'zurich', 5).map(i => i.label)).toHaveLength(2);
  });

  it('keeps the given order when nothing is typed, and caps the group', () => {
    const pages = buildPages();
    expect(rankItems(pages, '', 3)).toEqual(pages.slice(0, 3));
  });
});
