vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: () => ({}) }));

import { buildShelf, presentTypes } from '@/services/discover/view';
import { DISCOVER_MAX_RAILS, DISCOVER_RAIL_SIZE } from '@/config/discover-tabs';
import type { PublicHit } from '@/services/search/public-search';

const hit = (type: PublicHit['type'], id: string, createdAt: string) =>
  ({ type, id, title: id, createdAt }) as PublicHit;

describe('the Discover shelf', () => {
  it('orders kinds the way a visitor meets them and leaves out empty ones', () => {
    expect(presentTypes({ profile: 3, product: 1, project: 2, loan: 0 })).toEqual([
      'project',
      'product',
      'profile',
    ]);
  });

  it('opens with the newest across kinds, then one rail per kind', () => {
    const hits = [
      hit('project', 'p-old', '2026-01-01'),
      hit('product', 'x-new', '2026-10-01'),
      hit('project', 'p-new', '2026-09-01'),
    ];
    const shelf = buildShelf(hits, { project: 5, product: 1 });
    expect(shelf.fresh.map(h => h.id)).toEqual(['x-new', 'p-new', 'p-old']);
    expect(shelf.rails.map(r => [r.type, r.total, r.hits.length])).toEqual([
      ['project', 5, 2],
      ['product', 1, 1],
    ]);
    expect(shelf.more).toEqual([]);
  });

  it('caps the rails and offers the remaining kinds as links', () => {
    const types = [
      'project',
      'product',
      'service',
      'event',
      'cause',
      'profile',
      'group',
      'circle',
    ] as const;
    const hits = types.map((t, i) => hit(t, t, `2026-0${i + 1}-01`));
    const counts = Object.fromEntries(types.map(t => [t, 1]));
    const shelf = buildShelf(hits, counts);
    expect(shelf.rails).toHaveLength(DISCOVER_MAX_RAILS);
    expect(shelf.more).toEqual(['group', 'circle']);
    expect(shelf.fresh.length).toBeLessThanOrEqual(DISCOVER_RAIL_SIZE);
  });
});
