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

  it("a direct key's own models become pickable, strongest marked", async () => {
    const access = await getUsableModels(fakeSupabase({ providers: ['anthropic'] }), 'u1', {
      directKeyModels: async () => [
        {
          provider: 'anthropic',
          models: ['claude-opus-5-5', 'claude-sonnet-5'],
          suggested: 'claude-opus-5-5',
        },
      ],
    });
    const mine = access.models.filter(m => m.source === 'byok');
    expect(mine.map(m => m.id)).toEqual(['claude-opus-5-5', 'claude-sonnet-5']);
    expect(mine[0].provider).toMatch(/your key · strongest/);
    // Paid registry models stay locked — one provider's key is not a router.
    expect(access.locked).toHaveLength(PAID_COUNT);
    expect(access.allowsCustomModel).toBe(false);
  });

  it('a direct key that cannot be read adds nothing and breaks nothing', async () => {
    const access = await getUsableModels(fakeSupabase({ providers: ['openai'] }), 'u1', {
      directKeyModels: async () => {
        throw new Error('provider down');
      },
    });
    expect(access.models).toHaveLength(FREE_COUNT);
  });

  it('a non-aggregator key (e.g. xai) does not open the custom-model door', async () => {
    const access = await getUsableModels(fakeSupabase({ providers: ['xai'] }), 'u1');
    expect(access.allowsCustomModel).toBe(false);
    expect(access.byokProviders).toContain('xai');
  });
});
