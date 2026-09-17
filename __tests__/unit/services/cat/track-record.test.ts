/**
 * Cat track record derivation (track-record.ts).
 *
 * The outcome loop must be pure derivation over existing tables: proposals from
 * cat_action_log, current state from the entity tables, funding from settled
 * payment_intents. These tests pin the joins, the funnel counts, and the
 * degrade rules (log unreadable → null; partial lookups → partial record,
 * never a throw).
 */

import { getCatTrackRecord } from '@/services/cat/track-record';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

type Response = { data: unknown; error: { message: string } | null };

/**
 * Table-keyed chainable supabase mock: every builder method returns the chain,
 * and awaiting the chain resolves the table's preset response (in call order
 * when an array of responses is given).
 */
function mockSupabase(responses: Record<string, Response | Response[]>) {
  const counters: Record<string, number> = {};
  return {
    from(table: string) {
      const preset = responses[table];
      const pick = (): Response => {
        if (Array.isArray(preset)) {
          const i = counters[table] || 0;
          counters[table] = i + 1;
          return preset[Math.min(i, preset.length - 1)];
        }
        return preset ?? { data: [], error: null };
      };
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'in', 'gte', 'order', 'limit']) {
        chain[m] = () => chain;
      }
      chain.then = (resolve: (r: Response) => unknown) => Promise.resolve(pick()).then(resolve);
      return chain;
    },
  } as never;
}

const logRow = (actionId: string, entityId: string, overrides: Record<string, unknown> = {}) => ({
  action_id: actionId,
  result: { id: entityId },
  completed_at: '2026-07-01T00:00:00Z',
  created_at: '2026-07-01T00:00:00Z',
  ...overrides,
});

describe('getCatTrackRecord', () => {
  it('returns null when the action log is unreadable', async () => {
    const supabase = mockSupabase({
      cat_action_log: { data: null, error: { message: 'permission denied' } },
    });
    await expect(getCatTrackRecord(supabase, 'u1')).resolves.toBeNull();
  });

  it('returns an empty record when Cat created nothing in the window', async () => {
    const supabase = mockSupabase({ cat_action_log: { data: [], error: null } });
    await expect(getCatTrackRecord(supabase, 'u1')).resolves.toEqual({
      proposed: 0,
      published: 0,
      funded: 0,
      totalFundedBtc: 0,
      entries: [],
      setbacks: { failed: 0, denied: 0, unconfirmed: 0, recent: [] },
      windowDays: 90,
    });
  });

  it('joins proposals to entity state and settled funding', async () => {
    const supabase = mockSupabase({
      cat_action_log: {
        data: [logRow('create_product', 'p1'), logRow('create_project', 'j1')],
        error: null,
      },
      user_products: { data: [{ id: 'p1', title: 'Solar kit', status: 'active' }], error: null },
      projects: { data: [{ id: 'j1', title: 'Repair café', status: 'draft' }], error: null },
      payment_intents: {
        data: [
          { entity_id: 'p1', amount_btc: 0.001, status: 'paid' },
          { entity_id: 'p1', amount_btc: 0.002, status: 'buyer_confirmed' },
        ],
        error: null,
      },
    });

    const record = await getCatTrackRecord(supabase, 'u1');
    expect(record).toMatchObject({ proposed: 2, published: 1, funded: 1 });
    expect(record?.totalFundedBtc).toBeCloseTo(0.003, 8);
    expect(record?.entries).toEqual([
      expect.objectContaining({
        entityType: 'product',
        entityId: 'p1',
        title: 'Solar kit',
        status: 'active',
        fundedBtc: expect.closeTo(0.003, 8),
        payments: 2,
      }),
      expect.objectContaining({
        entityType: 'project',
        entityId: 'j1',
        title: 'Repair café',
        status: 'draft',
        fundedBtc: 0,
        payments: 0,
      }),
    ]);
  });

  it('marks entities that no longer exist as deleted (status null)', async () => {
    const supabase = mockSupabase({
      cat_action_log: { data: [logRow('create_service', 's1')], error: null },
      user_services: { data: [], error: null },
      payment_intents: { data: [], error: null },
    });
    const record = await getCatTrackRecord(supabase, 'u1');
    expect(record?.entries).toEqual([
      expect.objectContaining({ entityId: 's1', title: '(deleted)', status: null }),
    ]);
    expect(record?.published).toBe(0);
  });

  it('skips log rows whose result carries no entity id', async () => {
    const supabase = mockSupabase({
      cat_action_log: {
        data: [
          logRow('create_product', 'p1'),
          { action_id: 'create_product', result: null, completed_at: null, created_at: 'x' },
        ],
        error: null,
      },
      user_products: { data: [{ id: 'p1', title: 'Kit', status: 'active' }], error: null },
      payment_intents: { data: [], error: null },
    });
    const record = await getCatTrackRecord(supabase, 'u1');
    expect(record?.proposed).toBe(1);
  });

  it('degrades to unfunded entries when the funding lookup fails', async () => {
    const supabase = mockSupabase({
      cat_action_log: { data: [logRow('create_product', 'p1')], error: null },
      user_products: { data: [{ id: 'p1', title: 'Kit', status: 'active' }], error: null },
      payment_intents: { data: null, error: { message: 'boom' } },
    });
    const record = await getCatTrackRecord(supabase, 'u1');
    expect(record).toMatchObject({ proposed: 1, published: 1, funded: 0, totalFundedBtc: 0 });
  });
});
