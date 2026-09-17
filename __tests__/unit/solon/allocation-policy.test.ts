/**
 * Solon allocation policy — the governance invariants.
 *
 * 1. Canonical hashing is a cross-repo protocol: the golden hashes below are
 *    pinned to the SAME values as Solon's src/lib/domain/__tests__/canonical
 *    tests. If either side drifts, this fails in CI instead of decision
 *    verification failing in prod.
 * 2. activateVersion() must refuse any version without a locally verified
 *    Solon decision — there is no path to an active v2+ policy that bypasses
 *    a verified vote.
 */
import { canonicalJson, contentHashOf } from '@/services/solon/canonical';
import { activateVersion } from '@/services/solon/allocation-policy';
import { GENESIS_ALLOCATION_POLICY } from '@/config/solon';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe('canonical JSON (cross-repo contract with Solon)', () => {
  it('sorts keys recursively, keeps array order, drops undefined', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, 2], c: null }, e: 'x', skip: undefined })).toBe(
      '{"a":{"c":null,"d":[3,2]},"b":1,"e":"x"}'
    );
  });

  it('matches the golden hashes pinned on the Solon side', () => {
    expect(contentHashOf({ b: 1, a: { d: [3, 2], c: null }, e: 'x' })).toBe(
      '27411d33a050271292b9ea2eeb27d7271258c3fa82265c9fcf4ee0b0a58ca3d9'
    );
    expect(contentHashOf({ max_cat_daily_spend_btc: 0.002, max_cat_btc_per_action: 0.0005 })).toBe(
      '7db0d28f49cd8821e7bfd739af9af851ed944b9c4189d6e214760a7272a272f9'
    );
  });

  it('pins the genesis policy hash — both sides bootstrap from identical content', () => {
    expect(contentHashOf(GENESIS_ALLOCATION_POLICY)).toBe(
      '7778223670a5de2c663c82d0aa2c5146b3c865fe6d56a1e13efbb95a3119cb80'
    );
  });
});

// Minimal thenable query-builder mock: every chain resolves with the row
// configured for the current test.
function buildPolicySupabase(row: Record<string, unknown> | null) {
  const updates: { values: Record<string, unknown>; filters: unknown[][] }[] = [];
  const makeChain = () => {
    const filters: unknown[][] = [];
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'order', 'in']) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
    chain.eq = vi.fn((...args: unknown[]) => {
      filters.push(args);
      return chain;
    });
    chain.update = vi.fn((values: Record<string, unknown>) => {
      updates.push({ values, filters });
      return chain;
    });
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    chain.then = (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: row, error: null }));
    return chain;
  };
  return { from: vi.fn(() => makeChain()), _updates: updates };
}

describe('activateVersion', () => {
  it('refuses a draft without verified_at — an unverified decision activates nothing', async () => {
    const supabase = buildPolicySupabase({
      id: 'p2',
      policy_key: 'allocation_policy',
      version: 2,
      status: 'draft',
      verified_at: null,
      solon_decision_id: 'session-1',
    });

    const result = await activateVersion(supabase as never, 'p2');

    expect(result.activated).toBe(false);
    expect(result.reason).toContain('verified');
    expect(supabase._updates).toHaveLength(0); // nothing written
  });

  it('refuses a draft without a solon_decision_id even if verified_at is set', async () => {
    const supabase = buildPolicySupabase({
      id: 'p2',
      policy_key: 'allocation_policy',
      version: 2,
      status: 'draft',
      verified_at: new Date().toISOString(),
      solon_decision_id: null,
    });

    const result = await activateVersion(supabase as never, 'p2');

    expect(result.activated).toBe(false);
    expect(supabase._updates).toHaveLength(0);
  });

  it('activates a verified draft and supersedes the current active version', async () => {
    const supabase = buildPolicySupabase({
      id: 'p2',
      policy_key: 'allocation_policy',
      version: 2,
      status: 'draft',
      verified_at: new Date().toISOString(),
      solon_decision_id: 'session-1',
    });

    const result = await activateVersion(supabase as never, 'p2');

    expect(result).toEqual({ activated: true, version: 2 });
    expect(supabase._updates.map(u => u.values.status)).toEqual(['superseded', 'active']);
  });

  it('is idempotent for an already-active version', async () => {
    const supabase = buildPolicySupabase({
      id: 'p1',
      policy_key: 'allocation_policy',
      version: 1,
      status: 'active',
      verified_at: null,
      solon_decision_id: null,
    });

    const result = await activateVersion(supabase as never, 'p1');

    expect(result).toEqual({ activated: true, version: 1 });
    expect(supabase._updates).toHaveLength(0);
  });
});
