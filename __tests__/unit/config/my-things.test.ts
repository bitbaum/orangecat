/**
 * "My things" folds fifteen dashboards into one list. Two things keep that
 * honest: every type with a detail page declares where a row opens (so the
 * list never guesses a URL), and the sidebar carries the page plus the map in
 * its primary section — the two doors that replaced the entity sections.
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { ENTITY_REGISTRY, ENTITY_TYPES } from '@/config/entity-registry';
import { sidebarSections } from '@/config/navigation';
import { ROUTES } from '@/config/routes';
import { groupThingsByIntent, type Thing } from '@/domain/things/service';

const APP = join(process.cwd(), 'src', 'app', '(authenticated)');

function hasOwnerDetailRoute(basePath: string): boolean {
  const dir = join(APP, ...basePath.split('/').filter(Boolean));
  return ['[id]', '[slug]'].some(seg => existsSync(join(dir, seg, 'page.tsx')));
}

describe('a row in My things opens where its owner works on it', () => {
  it('declares detailPath for every type with a dashboard detail page', () => {
    for (const type of ENTITY_TYPES) {
      const meta = ENTITY_REGISTRY[type];
      if (hasOwnerDetailRoute(meta.basePath)) {
        expect(meta.detailPath, `${type} has a detail page but no detailPath`).toBeDefined();
      }
    }
  });

  it('builds a detailPath under a route that exists', () => {
    for (const type of ENTITY_TYPES) {
      const path = ENTITY_REGISTRY[type].detailPath?.('x');
      if (!path) {
        continue;
      }
      const segments = path.split('/').filter(Boolean);
      const dir = join(APP, ...segments.slice(0, -1));
      const exists = ['[id]', '[slug]'].some(seg => existsSync(join(dir, seg, 'page.tsx')));
      expect(exists, `${type}: ${path} does not resolve`).toBe(true);
    }
  });

  it('keys organisations by slug, everything else by id', () => {
    expect(ENTITY_REGISTRY.group.detailKeyColumn).toBe('slug');
    for (const type of ENTITY_TYPES.filter(t => t !== 'group')) {
      expect(ENTITY_REGISTRY[type].detailKeyColumn).toBeUndefined();
    }
  });
});

describe('the sidebar after the fold', () => {
  const main = sidebarSections.find(s => s.id === 'main');
  const hrefs = main?.items.map(i => i.href) ?? [];

  it('lists My things and the map in the primary section', () => {
    expect(hrefs).toContain(ROUTES.DASHBOARD.THINGS);
    expect(hrefs).toContain(ROUTES.WHAT_YOU_CAN_DO);
  });

  it('keeps the primary section short enough to read at a glance', () => {
    expect(hrefs.length).toBeLessThanOrEqual(6);
  });

  it('no longer lists entity types one by one', () => {
    const all = sidebarSections.flatMap(s => s.items.map(i => i.href));
    const entityLists = ENTITY_TYPES.map(t => ENTITY_REGISTRY[t].basePath);
    expect(all.filter(h => entityLists.includes(h))).toEqual([]);
  });
});

describe('groupThingsByIntent', () => {
  it('groups by the intent the registry declares and drops empty groups', () => {
    const things: Thing[] = [
      { type: 'product', id: '1', title: 'Bike', status: 'active', createdAt: null, href: '/x' },
      { type: 'project', id: '2', title: 'Roof', status: 'draft', createdAt: null, href: '/y' },
    ];
    const grouped = groupThingsByIntent(things);
    expect(grouped.map(g => g.intent.id)).toEqual(['earn', 'fund']);
    expect(grouped[0].things[0].title).toBe('Bike');
  });
});
