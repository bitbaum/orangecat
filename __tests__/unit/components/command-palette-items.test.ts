import { describe, expect, it } from 'vitest';
import {
  buildCreateItems,
  buildPages,
  groupHits,
  pagesFirst,
  rankItems,
  thingItems,
  typeHeading,
} from '@/components/search/command-palette-items';
import { publicHref, type PublicHit } from '@/services/search/public-search';
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

  it('links every search hit to its public page, by id or by its path key', () => {
    for (const type of ENTITY_TYPES.filter(t => t !== 'group')) {
      expect(publicHref(type, 'abc', null)).toBe(`${ENTITY_REGISTRY[type].publicBasePath}/abc`);
    }
    // Organisations are routed by slug, never by id; people by username.
    expect(publicHref('group', 'abc', 'zurich-btc')).toBe('/groups/zurich-btc');
    expect(publicHref('profile', 'abc', 'cato')).toBe('/profiles/cato');
  });

  it("groups hits by kind, in the order of each kind's best hit", () => {
    const hit = (type: string, id: string) => ({ type, id }) as PublicHit;
    const groups = groupHits([hit('project', '1'), hit('profile', '2'), hit('project', '3')]);
    expect(groups.map(g => [g.type, g.hits.map(h => h.id)])).toEqual([
      ['project', ['1', '3']],
      ['profile', ['2']],
    ]);
    expect(typeHeading('profile')).toBe('People');
    expect(typeHeading('project')).toBe(ENTITY_REGISTRY.project.namePlural);
  });

  it("puts a page first when it matched with no more typos than everyone's best", () => {
    const settings = rankItems(buildPages(), 'setings', 1);
    expect(settings[0]?.typos).toBe(1);
    expect(pagesFirst(settings, [{ typos: null }])).toBe(true);
    expect(pagesFirst(settings, [{ typos: 1 }])).toBe(true);
    expect(pagesFirst(settings, [{ typos: 0 }])).toBe(false);
    expect(pagesFirst([], [{ typos: 0 }])).toBe(false);
  });
});
