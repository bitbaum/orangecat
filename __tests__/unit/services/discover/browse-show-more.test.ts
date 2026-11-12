/**
 * /discover?type=groups said "8 organizations", showed five, and offered
 * "Show more" on every page up to the last (page 20 linked to page 21, which
 * is page 20 again). Three rows the query counted were dropped after it came
 * back, and "more" was decided against the rows kept, so asking again could
 * never close the gap. More exist only past the rows a page asked for.
 */
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: () => ({}) }));
vi.mock('@/services/search/find', () => ({ findPublic: vi.fn() }));

const searchPublic = vi.fn();
const countPublic = vi.fn();
vi.mock('@/services/search/public-search', () => ({
  searchPublic: (...args: unknown[]) => searchPublic(...args),
  countPublic: (...args: unknown[]) => countPublic(...args),
}));

import { loadDiscoverView } from '@/services/discover/view';
import { DISCOVER_PAGE_SIZE } from '@/config/discover-tabs';
import type { PublicHit } from '@/services/search/public-search';

const hits = (n: number) =>
  Array.from(
    { length: n },
    (_, i) => ({ type: 'group', id: `g${i}`, title: `G${i}` }) as PublicHit
  );

describe('Discover browse: Show more', () => {
  beforeEach(() => {
    countPublic.mockResolvedValue({ group: 8 });
  });

  it('stops when the query returned everything there is, even if some rows were dropped', async () => {
    searchPublic.mockResolvedValue({ hits: hits(5), total: 8 });
    for (const page of [1, 2, 20]) {
      const view = await loadDiscoverView({ q: '', type: 'group', page });
      expect(view).toMatchObject({ mode: 'browse', hasMore: false });
    }
  });

  it('offers more while rows lie past the ones this page asked for', async () => {
    searchPublic.mockResolvedValue({ hits: hits(DISCOVER_PAGE_SIZE), total: 30 });
    const view = await loadDiscoverView({ q: '', type: 'group', page: 1 });
    expect(searchPublic).toHaveBeenLastCalledWith(expect.anything(), {
      types: ['group'],
      limit: DISCOVER_PAGE_SIZE,
    });
    expect(view).toMatchObject({ mode: 'browse', hasMore: true });

    const second = await loadDiscoverView({ q: '', type: 'group', page: 2 });
    expect(second).toMatchObject({ mode: 'browse', hasMore: false });
  });
});
