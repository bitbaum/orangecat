import { prepareFreePool } from '@/services/ai/free-model-pool';
import { resolveProvider } from '@/services/cat/provider-resolver';
import { buildPlatformProviders } from '@/services/ai/platform-providers';
import { DEFAULT_FREE_MODEL_ID } from '@/config/ai-models';
import { lokiKeyOrder, lokiKeySteps, modelOnLokiKey } from '@/services/cat/loki-key-step';
import { parseLokiToolKey } from '@/services/cat/tool-transport';
import { sharedLokiOwnKeys } from '@/services/loki/shared-keys';

vi.mock('@/services/loki/shared-keys', () => ({
  sharedLokiOwnKeys: vi.fn(async () => []),
  askLokiModelDoor: vi.fn(),
  lokiModelUrl: () => 'https://loki.example/api/orangecat/model',
}));

vi.mock('@/services/ai/api-key-service', () => ({
  createApiKeyService: () => ({
    listDecryptedKeysOrdered: async () => [],
    getPlatformChainPosition: async () => 0,
    checkPlatformUsage: async () => ({
      can_use_platform: true,
      daily_limit: 10,
      requests_remaining: 10,
    }),
  }),
}));
vi.mock('@/services/ai/free-model-pool', () => ({ prepareFreePool: vi.fn(async () => {}) }));
vi.mock('@/services/ai/platform-providers', () => ({ buildPlatformProviders: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/services/cat/credit-metering', () => ({
  isPlatformMeteredModel: () => false,
  checkFrontierAccess: vi.fn(),
}));

it('uses a configured alternate-provider-only chain without requiring the original vendors', async () => {
  vi.stubEnv('GROQ_API_KEY', '');
  vi.stubEnv('OPENROUTER_API_KEY', '');
  const aiService = { chatCompletion: vi.fn(), streamChatCompletion: vi.fn() };
  vi.mocked(buildPlatformProviders).mockReturnValue([
    {
      providerId: 'google',
      defaultModel: 'fixture',
      aiService,
      toolEndpoint: 'https://example.test/chat/completions',
      toolKey: 'fixture',
      seesImages: 'yes',
    } as never,
  ]);
  try {
    const result = await resolveProvider({} as never, 'user', new Headers(), { message: 'Hello' });
    expect(result).not.toBeInstanceOf(Response);
    expect(result).toMatchObject({ provider: 'google', hasByok: false, aiService, fallbacks: [] });
  } finally {
    vi.unstubAllEnvs();
  }
});

it('waits for catalogue resolution before snapshotting the platform chain', async () => {
  let ready!: () => void;
  vi.mocked(prepareFreePool).mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        ready = resolve;
      })
  );
  vi.mocked(buildPlatformProviders).mockClear();
  vi.mocked(buildPlatformProviders).mockReturnValue([]);
  const resolving = resolveProvider({} as never, 'user', new Headers(), { message: 'Hello' });
  await vi.waitFor(() => expect(ready).toBeTypeOf('function'));
  expect(buildPlatformProviders).not.toHaveBeenCalled();
  ready();
  await resolving;
  expect(buildPlatformProviders).toHaveBeenCalledOnce();
});

/**
 * A key the person keeps on Loki, switched on for OrangeCat, answers their
 * Cat as it answers their bots. Seen live on 2026-11-13: the owner's xAI key
 * was switched on, the Cat said "Auto (Best Free)", and with the free pool
 * spent it could not answer.
 */
describe('a key kept on Loki', () => {
  const free = { chatCompletion: vi.fn(), streamChatCompletion: vi.fn() };
  const onLoki = [{ provider: 'xai', key: '', lokiActorId: 'actor-1', model: 'grok-test' }];

  beforeEach(() => {
    vi.mocked(buildPlatformProviders).mockReturnValue([
      { providerId: 'groq', defaultModel: 'free-model', aiService: free } as never,
    ]);
  });

  it('leads the Cat’s chain, with the free pool behind it', async () => {
    vi.mocked(sharedLokiOwnKeys).mockResolvedValueOnce(onLoki);
    const result = await resolveProvider({} as never, 'user', new Headers(), { message: 'Hi' });
    expect(result).toMatchObject({ provider: 'xai', hasByok: true, modelToUse: 'grok-test' });
    const resolved = result as Exclude<typeof result, Response>;
    // Its own key: no free-pool quota is counted against the turn.
    expect(resolved.platformUsage).toBeNull();
    expect(resolved.fallbacks.map(f => f.provider)).toEqual(['groq']);
    // The key is not here: the tool loop is pointed at Loki's door, with a
    // marker for whose key, so tools run on the model that answers.
    expect(parseLokiToolKey(resolved.toolKey)).toEqual({ provider: 'xai', actorId: 'actor-1' });
    expect(resolved.toolEndpoint).toMatch(/^https?:\/\//);
  });

  it('uses a model named from the key’s own list, and never sends it a free registry model', () => {
    expect(modelOnLokiKey(onLoki[0], 'grok-other')).toBe('grok-other');
    expect(modelOnLokiKey(onLoki[0], 'auto')).toBe('grok-test');
    expect(modelOnLokiKey(onLoki[0], undefined)).toBe('grok-test');
    expect(modelOnLokiKey(onLoki[0], DEFAULT_FREE_MODEL_ID)).toBe('grok-test');
  });

  it('steps behind a free model the person picked by name', () => {
    expect(lokiKeyOrder('auto', 0)).toBeLessThan(0);
    expect(lokiKeyOrder(undefined, 0)).toBeLessThan(0);
    expect(lokiKeyOrder('grok-other', 0)).toBeLessThan(0);
    expect(lokiKeyOrder(DEFAULT_FREE_MODEL_ID, 0)).toBeGreaterThan(1_000_000);
  });

  it('changes nothing for a person with no key on Loki, or when Loki does not answer', async () => {
    vi.mocked(sharedLokiOwnKeys).mockResolvedValueOnce([]);
    expect(
      await resolveProvider({} as never, 'user', new Headers(), { message: 'Hi' })
    ).toMatchObject({ provider: 'groq', hasByok: false });
    vi.mocked(sharedLokiOwnKeys).mockRejectedValueOnce(new Error('loki down'));
    expect(
      await resolveProvider({} as never, 'user', new Headers(), { message: 'Hi' })
    ).toMatchObject({ provider: 'groq', hasByok: false });
  });

  it('skips a provider this app has no name for', async () => {
    vi.mocked(sharedLokiOwnKeys).mockResolvedValueOnce([
      { provider: 'no-such-vendor', key: '', lokiActorId: 'actor-1' },
    ]);
    expect(await lokiKeySteps({} as never, 'user', undefined)).toEqual([]);
  });
});
