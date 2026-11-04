import { prepareFreePool } from '@/services/ai/free-model-pool';
import { resolveProvider } from '@/services/cat/provider-resolver';
import { buildPlatformProviders } from '@/services/ai/platform-providers';

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
