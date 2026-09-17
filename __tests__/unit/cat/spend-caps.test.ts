/**
 * Cat spend caps — enforcement tests
 *
 * cat_permissions.max_btc_per_action existed since baseline but was never read
 * (the "exists but not wired" class). These tests pin the enforcement added in
 * July 2026: per-action cap + daily BTC budget, checked in the permission
 * service and enforced by the executor on both the direct and the
 * confirm-pending paths.
 */

import { CatPermissionService, effectiveSpendCaps } from '@/services/cat/permission-service';
import { CatActionExecutor } from '@/services/cat/action-executor';
import { DATABASE_TABLES } from '@/config/database-tables';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Executor tests control permission behavior per-test via this mock instance.
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

// Keep the executor tests light — no real handlers (they import wallet/NWC code).
const mockSendPaymentHandler = vi.fn();
vi.mock('@/services/cat/handlers', () => ({
  ACTION_HANDLERS: {
    get send_payment() {
      return mockSendPaymentHandler;
    },
  },
}));

const USER_ID = 'user-1';
const ACTOR_ID = 'actor-1';

// ── effectiveSpendCaps (pure) ────────────────────────────────────────────────

describe('effectiveSpendCaps', () => {
  it('returns nulls when no rows define caps', () => {
    expect(effectiveSpendCaps([])).toEqual({ maxBtcPerAction: null, maxBtcPerDay: null });
    expect(effectiveSpendCaps([{ max_btc_per_action: null, max_btc_per_day: null }])).toEqual({
      maxBtcPerAction: null,
      maxBtcPerDay: null,
    });
  });

  it('takes the stricter (lower) cap when both specific and category rows define one', () => {
    const rows = [
      { max_btc_per_action: 0.01, max_btc_per_day: 0.05 },
      { max_btc_per_action: 0.002, max_btc_per_day: 0.1 },
    ];
    expect(effectiveSpendCaps(rows)).toEqual({ maxBtcPerAction: 0.002, maxBtcPerDay: 0.05 });
  });

  it('ignores null/absent values on one row while using the other', () => {
    const rows = [
      { max_btc_per_action: null },
      { max_btc_per_action: 0.001, max_btc_per_day: 0.01 },
    ];
    expect(effectiveSpendCaps(rows)).toEqual({ maxBtcPerAction: 0.001, maxBtcPerDay: 0.01 });
  });
});

// ── CatPermissionService.checkSpendCaps ──────────────────────────────────────

/**
 * Thenable query-builder mock keyed by table: awaiting the chain resolves with
 * the configured rows for that table.
 */
function buildCapsSupabase(config: {
  permissionRows: Record<string, unknown>[];
  logRows?: { amount_btc: number | null }[];
  /** Active allocation policy row (Solon platform ceiling); null = none. */
  policyRow?: Record<string, unknown> | null;
}) {
  const neqCalls: unknown[][] = [];
  const makeChain = (table: string) => {
    const rows =
      table === DATABASE_TABLES.CAT_PERMISSIONS ? config.permissionRows : (config.logRows ?? []);
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'gte', 'order', 'limit']) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
    chain.neq = vi.fn((...args: unknown[]) => {
      neqCalls.push(args);
      return chain;
    });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: config.policyRow ?? null, error: null });
    chain.then = (resolve: (value: { data: unknown }) => unknown) =>
      Promise.resolve(resolve({ data: rows }));
    return chain;
  };
  return {
    from: vi.fn((table: string) => makeChain(table)),
    _neqCalls: neqCalls,
  };
}

// checkSpendCaps tests need the REAL service class, not the module mock above.
const { CatPermissionService: RealPermissionService } = (await vi.importActual(
  '@/services/cat/permission-service'
)) as { CatPermissionService: typeof CatPermissionService };

describe('CatPermissionService.checkSpendCaps', () => {
  it('allows non-payment actions without querying permissions', async () => {
    const supabase = buildCapsSupabase({ permissionRows: [] });
    const service = new RealPermissionService(supabase as never);

    const result = await service.checkSpendCaps(USER_ID, 'create_product', 0.5);

    expect(result.allowed).toBe(true);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('allows payment actions with no amount (handler validates separately)', async () => {
    const supabase = buildCapsSupabase({ permissionRows: [] });
    const service = new RealPermissionService(supabase as never);

    const result = await service.checkSpendCaps(USER_ID, 'send_payment', null);

    expect(result.allowed).toBe(true);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('denies a payment above the per-action cap with an actionable reason', async () => {
    const supabase = buildCapsSupabase({
      permissionRows: [{ action_id: '*', max_btc_per_action: 0.001, max_btc_per_day: null }],
    });
    const service = new RealPermissionService(supabase as never);

    const result = await service.checkSpendCaps(USER_ID, 'send_payment', 0.002);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('per-action cap of 0.001 BTC');
  });

  it('allows a payment exactly at the per-action cap', async () => {
    const supabase = buildCapsSupabase({
      permissionRows: [{ action_id: '*', max_btc_per_action: 0.001, max_btc_per_day: null }],
    });
    const service = new RealPermissionService(supabase as never);

    const result = await service.checkSpendCaps(USER_ID, 'send_payment', 0.001);

    expect(result.allowed).toBe(true);
  });

  it('denies when the payment would exceed the daily budget, reporting remaining', async () => {
    const supabase = buildCapsSupabase({
      permissionRows: [{ action_id: '*', max_btc_per_action: null, max_btc_per_day: 0.01 }],
      logRows: [{ amount_btc: 0.004 }, { amount_btc: 0.004 }],
    });
    const service = new RealPermissionService(supabase as never);

    const result = await service.checkSpendCaps(USER_ID, 'send_payment', 0.005);

    expect(result.allowed).toBe(false);
    expect(result.spentTodayBtc).toBeCloseTo(0.008, 8);
    expect(result.reason).toContain('daily budget of 0.01 BTC');
  });

  it('allows within the daily budget and excludes the caller in-flight log row', async () => {
    const supabase = buildCapsSupabase({
      permissionRows: [{ action_id: '*', max_btc_per_day: 0.01 }],
      logRows: [{ amount_btc: 0.004 }],
    });
    const service = new RealPermissionService(supabase as never);

    const result = await service.checkSpendCaps(USER_ID, 'send_payment', 0.005, {
      excludeLogId: 'log-42',
    });

    expect(result.allowed).toBe(true);
    expect(supabase._neqCalls).toEqual([['id', 'log-42']]);
  });
});

// ── Executor wiring ──────────────────────────────────────────────────────────

function buildExecutorSupabase() {
  const insertsByTable: Record<string, unknown[]> = {};
  const updatesByTable: Record<string, unknown[]> = {};
  const makeChain = (table: string) => {
    const chain: Record<string, unknown> = {};
    chain.insert = vi.fn((payload: unknown) => {
      (insertsByTable[table] ??= []).push(payload);
      return chain;
    });
    chain.update = vi.fn((payload: unknown) => {
      (updatesByTable[table] ??= []).push(payload);
      return chain;
    });
    for (const method of ['select', 'eq', 'in', 'gte', 'neq', 'order', 'limit']) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
    chain.single = vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.then = (resolve: (value: { data: unknown }) => unknown) =>
      Promise.resolve(resolve({ data: [] }));
    return chain;
  };
  return {
    from: vi.fn((table: string) => makeChain(table)),
    _insertsByTable: insertsByTable,
    _updatesByTable: updatesByTable,
  };
}

describe('CatActionExecutor spend-cap enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionService.checkPermission.mockResolvedValue({
      allowed: true,
      requiresConfirmation: false,
    });
    mockSendPaymentHandler.mockResolvedValue({ success: true, data: { status: 'paid' } });
  });

  it('denies an over-cap payment before creating a pending action, leaving a denied audit row', async () => {
    mockPermissionService.checkSpendCaps.mockResolvedValue({
      allowed: false,
      reason: 'Amount 0.5 BTC exceeds your per-action cap of 0.001 BTC.',
    });
    const supabase = buildExecutorSupabase();
    const executor = new CatActionExecutor(supabase as never);

    const result = await executor.executeAction(USER_ID, ACTOR_ID, {
      actionId: 'send_payment',
      parameters: { amount_btc: 0.5, recipient: 'alice@getalby.com' },
    });

    expect(result.status).toBe('denied');
    expect(result.error).toContain('per-action cap');
    expect(supabase._insertsByTable[DATABASE_TABLES.CAT_PENDING_ACTIONS]).toBeUndefined();
    // Denials ARE audit rows now (loss side of the track record): one terminal
    // 'denied' insert with the reason, instead of no trace at all.
    const deniedRows = supabase._insertsByTable[DATABASE_TABLES.CAT_ACTION_LOG] as
      | { status: string; error_message: string | null }[]
      | undefined;
    expect(deniedRows).toHaveLength(1);
    expect(deniedRows?.[0]?.status).toBe('denied');
    expect(deniedRows?.[0]?.error_message).toContain('per-action cap');
    expect(mockSendPaymentHandler).not.toHaveBeenCalled();
  });

  it('re-checks caps at execution time (backstop) and logs the denial', async () => {
    // Early check passes; budget is consumed before execution → backstop denies.
    mockPermissionService.checkSpendCaps
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false, reason: 'daily budget exceeded' });
    const supabase = buildExecutorSupabase();
    const executor = new CatActionExecutor(supabase as never);

    const result = await executor.executeAction(USER_ID, ACTOR_ID, {
      actionId: 'send_payment',
      parameters: { amount_btc: 0.005, recipient: 'alice@getalby.com' },
    });

    expect(result.status).toBe('denied');
    expect(mockSendPaymentHandler).not.toHaveBeenCalled();
    // The backstop excludes the freshly-created log row from the budget sum
    expect(mockPermissionService.checkSpendCaps).toHaveBeenLastCalledWith(
      USER_ID,
      'send_payment',
      0.005,
      { excludeLogId: 'log-1' }
    );
    // Audit trail: the log row is marked denied with the reason
    const logUpdates = supabase._updatesByTable[DATABASE_TABLES.CAT_ACTION_LOG] as {
      status: string;
      error_message: string | null;
    }[];
    expect(logUpdates?.at(-1)?.status).toBe('denied');
    expect(logUpdates?.at(-1)?.error_message).toBe('daily budget exceeded');
  });

  it('executes a payment within caps', async () => {
    mockPermissionService.checkSpendCaps.mockResolvedValue({ allowed: true });
    const supabase = buildExecutorSupabase();
    const executor = new CatActionExecutor(supabase as never);

    const result = await executor.executeAction(USER_ID, ACTOR_ID, {
      actionId: 'send_payment',
      parameters: { amount_btc: 0.0005, recipient: 'alice@getalby.com' },
    });

    expect(result.status).toBe('completed');
    expect(mockSendPaymentHandler).toHaveBeenCalledTimes(1);
  });
});
