/**
 * Platform-wide spend ceiling — the Solon-governed allocation policy applied
 * as an additional min() over per-user cat_permissions caps in checkSpendCaps.
 *
 * The leash semantics under test: per-action ceiling bounds any single Cat
 * payment platform-wide; daily ceiling bounds ALL users' Cat payments
 * combined; no active policy (pre-genesis) or a failed read means per-user
 * caps still apply but no platform limit — governance must not brick payments
 * by being unreachable.
 */
import type { CatPermissionService } from '@/services/cat/permission-service';
import { DATABASE_TABLES } from '@/config/database-tables';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { CatPermissionService: RealPermissionService } = (await vi.importActual(
  '@/services/cat/permission-service'
)) as { CatPermissionService: typeof CatPermissionService };

const USER_ID = 'user-1';

/**
 * Thenable query-builder mock keyed by table. cat_action_log queries track
 * their .eq filters so tests can tell the per-user sum from the platform sum:
 * the platform query never filters by user_id.
 */
function buildSupabase(config: {
  permissionRows: Record<string, unknown>[];
  policyRow?: { version: number; content: Record<string, number> } | null;
  userLogRows?: { amount_btc: number | null }[];
  platformLogRows?: { amount_btc: number | null }[];
}) {
  const makeChain = (table: string) => {
    const eqFilters: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'in', 'gte', 'neq', 'order', 'limit']) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
    chain.eq = vi.fn((column: string, value: unknown) => {
      eqFilters[column] = value;
      return chain;
    });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: config.policyRow ?? null, error: null });
    chain.then = (resolve: (value: { data: unknown }) => unknown) => {
      let rows: unknown;
      if (table === DATABASE_TABLES.CAT_PERMISSIONS) {
        rows = config.permissionRows;
      } else {
        // cat_action_log: a user_id filter marks the per-user sum.
        rows = 'user_id' in eqFilters ? (config.userLogRows ?? []) : (config.platformLogRows ?? []);
      }
      return Promise.resolve(resolve({ data: rows }));
    };
    return chain;
  };
  return { from: vi.fn((table: string) => makeChain(table)) };
}

const POLICY = {
  version: 1,
  content: { max_cat_daily_spend_btc: 0.001, max_cat_btc_per_action: 0.00025 },
};

describe('platform allocation-policy ceiling in checkSpendCaps', () => {
  it('denies a payment above the platform per-action ceiling even with no user caps', async () => {
    const supabase = buildSupabase({ permissionRows: [], policyRow: POLICY });
    const service = new RealPermissionService(supabase as never);

    const result = await service.checkSpendCaps(USER_ID, 'send_payment', 0.0003);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('platform');
    expect(result.reason).toContain('0.00025');
    expect(result.reason).toContain('/governance');
  });

  it('denies when the payment would push the PLATFORM daily total over the ceiling', async () => {
    const supabase = buildSupabase({
      permissionRows: [],
      policyRow: POLICY,
      // Other users already spent 0.0009 today; this user spent nothing.
      platformLogRows: [{ amount_btc: 0.0005 }, { amount_btc: 0.0004 }],
      userLogRows: [],
    });
    const service = new RealPermissionService(supabase as never);

    const result = await service.checkSpendCaps(USER_ID, 'send_payment', 0.0002);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('daily ceiling');
  });

  it('allows a payment under both platform ceilings', async () => {
    const supabase = buildSupabase({
      permissionRows: [],
      policyRow: POLICY,
      platformLogRows: [{ amount_btc: 0.0005 }],
    });
    const service = new RealPermissionService(supabase as never);

    const result = await service.checkSpendCaps(USER_ID, 'send_payment', 0.0002);

    expect(result.allowed).toBe(true);
  });

  it('applies the stricter of user cap and platform ceiling (user cap wins here)', async () => {
    const supabase = buildSupabase({
      permissionRows: [{ action_id: '*', max_btc_per_action: 0.0001, max_btc_per_day: null }],
      policyRow: POLICY,
    });
    const service = new RealPermissionService(supabase as never);

    const result = await service.checkSpendCaps(USER_ID, 'send_payment', 0.0002);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('your per-action cap');
  });

  it('applies no platform limit when no policy is active (pre-genesis)', async () => {
    const supabase = buildSupabase({ permissionRows: [], policyRow: null });
    const service = new RealPermissionService(supabase as never);

    const result = await service.checkSpendCaps(USER_ID, 'send_payment', 1);

    expect(result.allowed).toBe(true);
  });
});
