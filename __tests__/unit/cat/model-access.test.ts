/**
 * getUsableModels — access is DERIVED, never a fake list.
 *
 * Proves the picker SSOT reflects real state: free pool always, paid models
 * only when a routing key (BYOK) or Cat Credits back them, and the custom-model
 * door only opens with a verified aggregator (OpenRouter) key.
 */
import { getUsableModels } from '@/services/cat/model-access';
import { getFreeModels, getAvailableModels } from '@/config/ai-models';
import { MIN_FRONTIER_BALANCE_BTC } from '@/services/cat/credit-metering';

const FREE_COUNT = getFreeModels().length;
const PAID_COUNT = getAvailableModels().filter(m => !m.isFree).length;

/** Minimal thenable Supabase stub: from().select().eq().eq() → {data}, rpc() → {data}. */
function fakeSupabase(opts: { providers?: string[]; balance?: number }) {
  const keyRows = (opts.providers ?? []).map(provider => ({ provider }));
  const result = Promise.resolve({ data: keyRows, error: null });
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    then: result.then.bind(result),
    catch: result.catch.bind(result),
  };
  return {
    from: () => chain,
    rpc: async () => ({ data: opts.balance ?? 0, error: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('getUsableModels — access derivation', () => {
  it('sanity: registry has both free and paid models', () => {
    expect(FREE_COUNT).toBeGreaterThan(0);
    expect(PAID_COUNT).toBeGreaterThan(0);
  });

  it('no keys, no credits → free pool only; every paid model is locked', async () => {
    const access = await getUsableModels(fakeSupabase({}), 'u1');
    expect(access.models).toHaveLength(FREE_COUNT);
    expect(access.models.every(m => m.source === 'free')).toBe(true);
    expect(access.locked).toHaveLength(PAID_COUNT);
    expect(
      access.locked.every(m => m.unlock.includes('credits') && m.unlock.includes('byok'))
    ).toBe(true);
    expect(access.allowsCustomModel).toBe(false);
    expect(access.byokProviders).toEqual([]);
  });

  it('verified OpenRouter key → every paid model usable via byok; custom door opens', async () => {
    const access = await getUsableModels(fakeSupabase({ providers: ['openrouter'] }), 'u1');
    expect(access.locked).toHaveLength(0);
    expect(access.models).toHaveLength(FREE_COUNT + PAID_COUNT);
    expect(access.models.some(m => m.source === 'byok')).toBe(true);
    expect(access.allowsCustomModel).toBe(true);
    expect(access.byokProviders).toContain('openrouter');
  });

  it('credits balance, no key → paid models served via credits; custom door stays shut', async () => {
    const access = await getUsableModels(fakeSupabase({ balance: MIN_FRONTIER_BALANCE_BTC }), 'u1');
    expect(access.locked).toHaveLength(0);
    expect(access.models.some(m => m.source === 'credits')).toBe(true);
    expect(access.allowsCustomModel).toBe(false);
  });

  it('a below-threshold balance does NOT unlock frontier', async () => {
    const access = await getUsableModels(
      fakeSupabase({ balance: MIN_FRONTIER_BALANCE_BTC / 2 }),
      'u1'
    );
    expect(access.locked).toHaveLength(PAID_COUNT);
    expect(access.models.every(m => m.source === 'free')).toBe(true);
  });

  it("the user's own endpoint opens the custom-model door — no registry can name its models", async () => {
    const access = await getUsableModels(fakeSupabase({ providers: ['custom'] }), 'u1');
    expect(access.allowsCustomModel).toBe(true);
    expect(access.byokProviders).toContain('custom');
    // But it unlocks no PAID registry model: those are served by vendors, not by that box.
    expect(access.locked).toHaveLength(PAID_COUNT);
  });

  it('a non-aggregator key (e.g. xai) does not open the custom-model door', async () => {
    const access = await getUsableModels(fakeSupabase({ providers: ['xai'] }), 'u1');
    expect(access.allowsCustomModel).toBe(false);
    expect(access.byokProviders).toContain('xai');
  });
});
