import { getUserPlan } from '@/services/billing/getUserPlan';

/**
 * Builds a minimal Supabase chain that resolves `from('user_plans').select(...)
 * .eq('user_id', uid).maybeSingle()` to the given { data, error } pair.
 */
function mockSupabase(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any;
}

describe('getUserPlan', () => {
  const userId = '00000000-0000-0000-0000-000000000001';

  it('falls back to free when no row exists', async () => {
    const supabase = mockSupabase({ data: null, error: null });
    const plan = await getUserPlan(supabase, userId);
    expect(plan).toEqual({
      tier: 'free',
      dailyLimit: 10,
      expiresAt: null,
      isExpired: false,
    });
  });

  it('falls back to free when Supabase errors', async () => {
    const supabase = mockSupabase({
      data: null,
      error: { message: 'rls denied' },
    });
    const plan = await getUserPlan(supabase, userId);
    expect(plan.tier).toBe('free');
    expect(plan.dailyLimit).toBe(10);
  });

  it('returns pro plan when row says pro and not expired', async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const supabase = mockSupabase({
      data: { tier: 'pro', daily_limit: 200, expires_at: future },
      error: null,
    });
    const plan = await getUserPlan(supabase, userId);
    expect(plan.tier).toBe('pro');
    expect(plan.dailyLimit).toBe(200);
    expect(plan.expiresAt).toBe(future);
    expect(plan.isExpired).toBe(false);
  });

  it('collapses expired pro to free defaults but keeps expiresAt + isExpired', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const supabase = mockSupabase({
      data: { tier: 'pro', daily_limit: 200, expires_at: past },
      error: null,
    });
    const plan = await getUserPlan(supabase, userId);
    expect(plan.tier).toBe('free');
    expect(plan.dailyLimit).toBe(10);
    expect(plan.expiresAt).toBe(past);
    expect(plan.isExpired).toBe(true);
  });

  it('returns free when row.tier=free regardless of daily_limit override', async () => {
    const supabase = mockSupabase({
      data: { tier: 'free', daily_limit: 50, expires_at: null },
      error: null,
    });
    const plan = await getUserPlan(supabase, userId);
    expect(plan.tier).toBe('free');
    // Free users don't override the limit; they get the FREE_PLAN default
    expect(plan.dailyLimit).toBe(10);
  });
});
