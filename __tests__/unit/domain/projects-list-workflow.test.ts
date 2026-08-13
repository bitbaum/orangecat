import { listProjectsPage } from '@/domain/projects/service';

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}));

jest.mock('@/domain/actors', () => ({
  getUserActorId: jest.fn().mockResolvedValue('a1'),
}));

// Funding enrichment converts settled BTC totals via the currency service —
// keep the test deterministic (identity conversion, no rate fetch).
jest.mock('@/services/currency', () => ({
  currencyConverter: { getRates: jest.fn().mockResolvedValue({}) },
  convertBtcTo: (amountBtc: number) => amountBtc,
}));

import { createServerClient } from '@/lib/supabase/server';

describe('Project list workflow', () => {
  const dataRows = [
    {
      id: 'p1',
      user_id: 'u1',
      title: 'A',
      status: 'active',
      raised_amount: null,
      profiles: {
        id: 'u1',
        username: 'alice',
        name: 'Alice',
        avatar_url: null,
        email: 'a@test.dev',
      },
    },
    {
      id: 'p2',
      user_id: 'u2',
      title: 'B',
      status: 'active',
      raised_amount: 1200,
      profiles: { id: 'u2', username: 'bob', name: 'Bob', avatar_url: null, email: 'b@test.dev' },
    },
  ];

  /**
   * Create a chainable mock query that supports arbitrary .select/.eq/.order/.range/.in chains.
   * The final resolution happens when .range() is called (for data queries)
   * or after all .eq() chains are done (for count queries).
   */
  function makeChainableQuery(resolveValue: any) {
    const query: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
    };
    // Make query thenable so Promise.all resolves it
    query.then = (resolve: any, reject: any) => Promise.resolve(resolveValue).then(resolve, reject);
    return query;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists active projects and maps funding from the settled ledger, not the dead column', async () => {
    const dataQuery = makeChainableQuery({ data: dataRows, error: null });
    const countQuery = makeChainableQuery({ count: 2, error: null });

    const from = jest.fn().mockReturnValueOnce(dataQuery).mockReturnValueOnce(countQuery);
    // Settled funding stats: only p2 has real contributions. The raised_amount
    // column value (1200 on p2) must be IGNORED — nothing ever writes it.
    const rpc = jest.fn().mockResolvedValue({
      data: [{ entity_id: 'p2', total_btc: 0.01, contributor_count: 2, named_supporter_count: 1 }],
      error: null,
    });

    (createServerClient as jest.Mock).mockResolvedValue({ from, rpc });

    const result = await listProjectsPage(20, 0);

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].profiles?.username).toBe('alice');
    expect(result.items[0].raised_amount).toBe(0);
    expect(result.items[0].supporters_count).toBe(0);
    // p2: settled ledger total (0.01 BTC, identity-converted) — NOT the dead 1200.
    expect(result.items[1].raised_amount).toBe(0.01);
    expect(result.items[1].settled_raised_btc).toBe(0.01);
    expect(result.items[1].supporters_count).toBe(2);
  });

  it('applies user filter when userId is provided', async () => {
    const dataQuery = makeChainableQuery({ data: [dataRows[0]], error: null });
    const countQuery = makeChainableQuery({ count: 1, error: null });

    const from = jest.fn().mockReturnValueOnce(dataQuery).mockReturnValueOnce(countQuery);

    (createServerClient as jest.Mock).mockResolvedValue({ from });

    const result = await listProjectsPage(20, 0, 'u1');

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].user_id).toBe('u1');
  });
});
