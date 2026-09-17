import {
  PROVIDER_RUNTIME,
  OPENAI_COMPAT_PROVIDER_IDS,
  getProviderRuntime,
  isOpenAICompatibleProvider,
} from '@/config/ai-provider-runtime';
import {
  OpenAICompatibleService,
  createOpenAICompatibleServiceWithByok,
} from '@/services/ai/openai-compat';

describe('ai-provider-runtime', () => {
  it('declares OpenAI, Together, DeepSeek, and xAI', () => {
    expect(OPENAI_COMPAT_PROVIDER_IDS).toEqual(
      expect.arrayContaining(['openai', 'together', 'deepseek', 'xai'])
    );
  });

  it.each(OPENAI_COMPAT_PROVIDER_IDS)(
    'provides a base URL and default model for %s',
    providerId => {
      const runtime = getProviderRuntime(providerId);
      expect(runtime).not.toBeNull();
      expect(runtime!.baseUrl).toMatch(/^https:\/\//);
      expect(runtime!.defaultModel.length).toBeGreaterThan(0);
    }
  );

  it('returns null for unknown providers', () => {
    expect(getProviderRuntime('unknown-provider')).toBeNull();
  });

  it('isOpenAICompatibleProvider matches every declared id', () => {
    for (const id of OPENAI_COMPAT_PROVIDER_IDS) {
      expect(isOpenAICompatibleProvider(id)).toBe(true);
    }
    expect(isOpenAICompatibleProvider('groq')).toBe(false);
    expect(isOpenAICompatibleProvider('openrouter')).toBe(false);
    expect(isOpenAICompatibleProvider('')).toBe(false);
  });

  it('PROVIDER_RUNTIME keys match OPENAI_COMPAT_PROVIDER_IDS', () => {
    expect(Object.keys(PROVIDER_RUNTIME).sort()).toEqual([...OPENAI_COMPAT_PROVIDER_IDS].sort());
  });
});

describe('OpenAICompatibleService', () => {
  it('factory returns a service flagged as BYOK', () => {
    const svc = createOpenAICompatibleServiceWithByok({
      apiKey: 'sk-test-1234567890abcdef',
      baseUrl: 'https://api.example.com/v1',
      providerId: 'together',
    });
    expect(svc).toBeInstanceOf(OpenAICompatibleService);
    expect(svc.isUsingByok()).toBe(true);
  });

  it('strips trailing whitespace and control chars from the key', async () => {
    // Spies on fetch to confirm the Authorization header is sanitized
    // before it ever reaches the wire.
    const fakeResponse = {
      ok: true,
      status: 200,
      json: async () => ({ choices: [], usage: {} }),
    } as unknown as Response;
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(fakeResponse);

    const svc = createOpenAICompatibleServiceWithByok({
      apiKey: 'sk-test-1234567890abcdef\n',
      baseUrl: 'https://api.example.com/v1',
      providerId: 'openai',
    });

    await svc.chatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hi' }],
    });

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test-1234567890abcdef');
    fetchSpy.mockRestore();
  });
});
