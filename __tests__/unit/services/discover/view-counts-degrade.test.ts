/**
 * The counts only decorate Discover's chips. A count that cannot be read
 * leaves the page without numbers; it does not take the page down. (The
 * listings themselves still go to the error page with Try again.)
 */
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: () => ({}) }));
vi.mock('@/services/search/public-search', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/search/public-search')>();
  return {
    ...actual,
    countPublic: vi.fn(async () => {
      throw new Error('public_counts threw');
    }),
    searchPublic: vi.fn(async () => ({ hits: [], total: 0 })),
  };
});

import { loadDiscoverView } from '@/services/discover/view';

describe('Discover when the counts cannot be read', () => {
  it('draws the shelf without counts', async () => {
    const view = await loadDiscoverView({ q: '', type: undefined, page: 1 } as never);
    expect(view.mode).toBe('shelf');
    expect(view.counts).toEqual({});
  });

  it('draws a kind page without counts', async () => {
    const view = await loadDiscoverView({ q: '', type: 'project', page: 1 } as never);
    expect(view.mode).toBe('browse');
    expect(view.counts).toEqual({});
  });
});
