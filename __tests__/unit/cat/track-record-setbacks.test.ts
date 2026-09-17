/**
 * Track record — loss side (setbacks).
 *
 * The funnel (proposed → published → funded) only ever counted wins:
 * failures/denials never reached context, so the Cat could re-propose its
 * losses forever (survivorship bias in an agent's memory). These tests pin
 * the setback derivation, the renderer, and the executor's denial audit rows.
 */

import { getCatTrackRecord } from '@/services/cat/track-record';
import { renderTrackRecord } from '@/services/ai/context-sections';
import { CatActionExecutor } from '@/services/cat/action-executor';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mockPermissionService = {
  checkPermission: vi.fn(),
  checkSpendCaps: vi.fn(),
};
vi.mock('@/services/cat/permission-service', async () => {
  const actual = await vi.importActual('@/services/cat/permission-service');
  return {
    ...actual,
    // function (not arrow): vitest constructs mock implementations with `new`.
    CatPermissionService: vi.fn().mockImplementation(function () {
      return mockPermissionService;
    }),
  };
});
vi.mock('@/services/cat/handlers', () => ({ ACTION_HANDLERS: {} }));

const USER_ID = 'user-1';

/**
 * Minimal thenable query-builder fake: routes a query to canned rows based on
 * table + how it was filtered (the funnel query filters status='completed' via
 * .eq; the setback query filters status via .in).
 */
function fakeSupabase(routes: {
  funnelLog?: unknown[];
  setbackLog?: unknown[] | { error: string };
  pending?: unknown[] | { error: string };
  inserts?: Array<{ table: string; row: Record<string, unknown> }>;
}): AnySupabaseClient {
  const resolve = (table: string, filters: Record<string, unknown>) => {
    if (table === DATABASE_TABLES.CAT_ACTION_LOG) {
      const target = filters['in:status'] ? (routes.setbackLog ?? []) : (routes.funnelLog ?? []);
      return Array.isArray(target)
        ? { data: target, error: null }
        : { data: null, error: { message: target.error } };
    }
    if (table === DATABASE_TABLES.CAT_PENDING_ACTIONS) {
      const target = routes.pending ?? [];
      return Array.isArray(target)
        ? { data: target, error: null }
        : { data: null, error: { message: target.error } };
    }
    return { data: [], error: null };
  };
  return {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (col: string, v: unknown) => ((filters[`eq:${col}`] = v), builder),
        in: (col: string, v: unknown) => ((filters[`in:${col}`] = v), builder),
        gte: () => builder,
        order: () => builder,
        limit: () => builder,
        insert: (row: Record<string, unknown>) => {
          routes.inserts?.push({ table, row });
          return Promise.resolve({ data: null, error: null });
        },
        then: (onFulfilled: (v: unknown) => unknown) =>
          Promise.resolve(resolve(table, filters)).then(onFulfilled),
      };
      return builder;
    },
  } as unknown as AnySupabaseClient;
}

const NOW = new Date().toISOString();

describe('getCatTrackRecord setbacks', () => {
  it('derives failed/denied/unconfirmed counts and a merged recent list', async () => {
    const record = await getCatTrackRecord(
      fakeSupabase({
        funnelLog: [],
        setbackLog: [
          {
            action_id: 'send_payment',
            status: 'denied',
            error_message: 'Spend cap exceeded',
            created_at: '2026-08-02T10:00:00Z',
          },
          {
            action_id: 'create_product',
            status: 'failed',
            error_message: 'boom',
            created_at: '2026-08-01T10:00:00Z',
          },
        ],
        pending: [
          {
            action_id: 'send_payment',
            status: 'expired',
            rejection_reason: null,
            created_at: '2026-08-02T09:00:00Z',
          },
          {
            action_id: 'create_event',
            status: 'rejected',
            rejection_reason: 'not now',
            created_at: '2026-07-30T10:00:00Z',
          },
        ],
      }),
      USER_ID
    );

    expect(record).not.toBeNull();
    expect(record!.setbacks.failed).toBe(1);
    expect(record!.setbacks.denied).toBe(1);
    expect(record!.setbacks.unconfirmed).toBe(2);
    // Merged newest-first across both sources.
    expect(record!.setbacks.recent.map(s => s.kind)).toEqual([
      'denied',
      'expired',
      'failed',
      'rejected',
    ]);
    expect(record!.setbacks.recent[0].reason).toBe('Spend cap exceeded');
  });

  it('degrades to zero setbacks on query errors (e.g. un-migrated enum) without killing the funnel', async () => {
    const record = await getCatTrackRecord(
      fakeSupabase({
        funnelLog: [],
        setbackLog: { error: 'invalid input value for enum cat_action_status: "denied"' },
        pending: { error: 'nope' },
      }),
      USER_ID
    );
    expect(record).not.toBeNull();
    expect(record!.setbacks).toEqual({ failed: 0, denied: 0, unconfirmed: 0, recent: [] });
  });
});

describe('renderTrackRecord setbacks', () => {
  const base = {
    proposed: 0,
    published: 0,
    funded: 0,
    totalFundedBtc: 0,
    entries: [],
    windowDays: 90,
  };

  it('renders a record with ONLY setbacks (all-denials is still a record)', () => {
    const out = renderTrackRecord({
      ...base,
      setbacks: {
        failed: 0,
        denied: 2,
        unconfirmed: 1,
        recent: [{ actionId: 'send_payment', kind: 'denied', reason: 'cap', at: NOW }],
      },
    });
    expect(out).toContain('Setbacks: 0 failed · 2 denied · 1 unconfirmed');
    expect(out).toContain('send_payment — denied: cap');
    expect(out).toContain("don't re-propose an action that was denied");
  });

  it('stays null when there is nothing either way (cold start unchanged)', () => {
    expect(
      renderTrackRecord({
        ...base,
        setbacks: { failed: 0, denied: 0, unconfirmed: 0, recent: [] },
      })
    ).toBeNull();
  });
});

describe('executor denial audit rows', () => {
  it('logs a denied row when permission is refused (previously: no trace at all)', async () => {
    const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
    const executor = new CatActionExecutor(fakeSupabase({ inserts }));
    mockPermissionService.checkPermission.mockResolvedValue({
      allowed: false,
      reason: 'Category disabled',
    });

    const result = await executor.executeAction(USER_ID, 'actor-1', {
      actionId: 'send_message',
      parameters: {},
    });

    expect(result.status).toBe('denied');
    const logged = inserts.find(i => i.table === DATABASE_TABLES.CAT_ACTION_LOG);
    expect(logged).toBeDefined();
    expect(logged!.row.status).toBe('denied');
    expect(logged!.row.error_message).toBe('Category disabled');
  });

  it('logs a denied row when the early spend cap refuses', async () => {
    const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
    const executor = new CatActionExecutor(fakeSupabase({ inserts }));
    mockPermissionService.checkPermission.mockResolvedValue({
      allowed: true,
      requiresConfirmation: false,
    });
    mockPermissionService.checkSpendCaps.mockResolvedValue({
      allowed: false,
      reason: 'Spend cap exceeded: 0.01 > 0.001',
    });

    const result = await executor.executeAction(USER_ID, 'actor-1', {
      actionId: 'send_payment',
      parameters: { amount_btc: 0.01 },
    });

    expect(result.status).toBe('denied');
    const logged = inserts.find(i => i.table === DATABASE_TABLES.CAT_ACTION_LOG);
    expect(logged?.row.status).toBe('denied');
    expect(logged?.row.amount_btc).toBe(0.01);
  });
});
