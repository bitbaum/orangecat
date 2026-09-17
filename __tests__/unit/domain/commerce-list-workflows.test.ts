import { listEntitiesPage } from '@/domain/commerce/service';

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/services/actors/getOrCreateUserActor', () => ({
  getOrCreateUserActor: vi.fn().mockResolvedValue({ id: 'a1' }),
}));

import { createServerClient } from '@/lib/supabase/server';

import type { Mock } from 'vitest';

describe('Commerce list workflows (services/products/causes)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeSupabaseForRows(rows: any[], totalCount: number) {
    const itemsResult = { data: rows, error: null };
    const countResult = { count: totalCount, error: null };

    const itemsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      then: (resolve: (v: any) => unknown) => Promise.resolve(resolve(itemsResult)),
    } as any;

    const countQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: (v: any) => unknown) => Promise.resolve(resolve(countResult)),
    } as any;

    const from = vi.fn().mockReturnValueOnce(itemsQuery).mockReturnValueOnce(countQuery);
    (createServerClient as Mock).mockResolvedValue({ from });

    return { itemsQuery, countQuery };
  }

  it('lists active services by default', async () => {
    const rows = [
      { id: 's1', title: 'Service A', status: 'active' },
      { id: 's2', title: 'Service B', status: 'active' },
    ];

    const { itemsQuery } = makeSupabaseForRows(rows, 2);

    const result = await listEntitiesPage('user_services', { limit: 20, offset: 0 });

    expect(itemsQuery.eq).toHaveBeenCalledWith('status', 'active');
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('includes own drafts when includeOwnDrafts=true with user filter', async () => {
    const rows = [{ id: 'p1', title: 'Draft Product', status: 'draft', user_id: 'u1' }];

    const { itemsQuery, countQuery } = makeSupabaseForRows(rows, 1);

    const result = await listEntitiesPage('user_products', {
      limit: 20,
      offset: 0,
      userId: 'u1',
      includeOwnDrafts: true,
    });

    expect(itemsQuery.eq).toHaveBeenCalledWith('actor_id', 'a1');
    expect(countQuery.eq).toHaveBeenCalledWith('actor_id', 'a1');
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('applies category filter on public cause listing', async () => {
    const rows = [{ id: 'c1', title: 'Cause A', category: 'charity', status: 'active' }];

    const { itemsQuery } = makeSupabaseForRows(rows, 1);

    const result = await listEntitiesPage('user_causes', {
      limit: 20,
      offset: 0,
      category: 'charity',
    });

    expect(itemsQuery.eq).toHaveBeenCalledWith('status', 'active');
    expect(itemsQuery.eq).toHaveBeenCalledWith('category', 'charity');
    expect(result.items).toHaveLength(1);
  });
});
