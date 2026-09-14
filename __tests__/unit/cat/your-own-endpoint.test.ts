/**
 * "Any model" has to include one nobody here has heard of.
 *
 * The transport has been provider-agnostic since 2026-06: one OpenAI-compatible
 * client takes any base URL. What was missing was a ROW that could carry a
 * URL, so "any model" meant "any of six vendors we spelled out" — vLLM,
 * llama.cpp, a remote Ollama, LiteLLM, a model you trained yourself were all
 * unreachable, not because the engine could not call them but because the
 * chain had nowhere to learn where they were.
 *
 * Three properties, each of which is a way this could quietly regress:
 *
 *  1. A stored 'custom' key becomes a chain step aimed at ITS OWN URL, with
 *     ITS OWN model, and drives the tool loop there — not at a vendor.
 *  2. An empty key is a credential ("send nothing"), not a missing one. A
 *     no-auth server must get the tool loop, with no Authorization header.
 *  3. Two no-auth servers share an empty key and must BOTH stay in the chain;
 *     deduping on the key alone would silently drop the second.
 */
import { resolveProvider } from '@/services/cat/provider-resolver';
import { maybeEnrichWithSearchResults } from '@/services/cat/tool-use';
import { OpenAICompatibleService } from '@/services/ai/openai-compat';
import { CUSTOM_PROVIDER_ID } from '@/data/aiProviders';
import type { DecryptedKeyRow } from '@/services/ai/api-key-service';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { ToolAugmentedMessage } from '@/services/cat/tool-use-types';

const rows: DecryptedKeyRow[] = [];

vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: () => ({}) }));
vi.mock('@/services/ai/api-key-service', () => ({
  createApiKeyService: () => ({
    listDecryptedKeysOrdered: async () => rows,
    getPlatformChainPosition: async () => 0,
    checkPlatformUsage: async () => ({
      daily_requests: 0,
      daily_limit: 10,
      requests_remaining: 10,
      can_use_platform: true,
    }),
  }),
}));

const supabase = {} as AnySupabaseClient;
const realFetch = global.fetch;
const realEnv = { ...process.env };

function ownServer(over: Partial<DecryptedKeyRow> = {}): DecryptedKeyRow {
  return {
    id: 'k1',
    provider: CUSTOM_PROVIDER_ID,
    key: '',
    sortOrder: 0,
    baseUrl: 'https://models.example.org/v1',
    defaultModel: 'my-finetune-7b',
    ...over,
  };
}

beforeEach(() => {
  rows.length = 0;
  // No platform vendors configured: the chain is exactly the user's rows.
  for (const k of [
    'GROQ_API_KEY',
    'OPENROUTER_API_KEY',
    'TOGETHER_API_KEY',
    'PLATFORM_OLLAMA_URL',
    'CEREBRAS_API_KEY',
  ]) {
    delete process.env[k];
  }
});

afterEach(() => {
  global.fetch = realFetch;
  process.env = { ...realEnv };
  vi.restoreAllMocks();
});

async function resolve(requestedModel?: string) {
  const out = await resolveProvider(supabase, 'user-1', new Headers(), {
    requestedModel,
    message: 'hello',
  });
  if (out instanceof Response) {
    throw new Error(`resolver returned HTTP ${out.status}`);
  }
  return out;
}

describe('a stored endpoint becomes a chain step aimed at itself', () => {
  it('uses the row URL, the row model, and points the tool loop at that URL', async () => {
    rows.push(ownServer({ key: 'secret-token' }));

    const r = await resolve();

    expect(r.provider).toBe(CUSTOM_PROVIDER_ID);
    expect(r.hasByok).toBe(true);
    expect(r.modelToUse).toBe('my-finetune-7b');
    expect(r.aiService).toBeInstanceOf(OpenAICompatibleService);
    expect(r.toolEndpoint).toBe('https://models.example.org/v1/chat/completions');
    expect(r.toolKey).toBe('secret-token');
    expect(r.platformUsage).toBeNull(); // the user's own server is never quota-capped
  });

  it('an explicit model for the turn overrides the row default', async () => {
    rows.push(ownServer());
    const r = await resolve('my-finetune-70b');
    expect(r.modelToUse).toBe('my-finetune-70b');
  });

  it('a row without a URL or a model is not a step at all', async () => {
    // Nothing here comes from a registry, so a row that cannot say where or
    // what is skipped — silently building a step would fail every turn.
    rows.push(ownServer({ baseUrl: null }));
    const out = await resolveProvider(supabase, 'user-1', new Headers(), { message: 'hi' });
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(503);
  });
});

describe('an empty key is a credential, not a missing one', () => {
  it('keeps toolKey as "" rather than dropping the tool loop', async () => {
    rows.push(ownServer({ key: '' }));
    const r = await resolve();
    expect(r.toolEndpoint).toBe('https://models.example.org/v1/chat/completions');
    expect(r.toolKey).toBe('');
  });

  it('the tool loop calls a no-auth server with NO Authorization header', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    global.fetch = vi.fn(async (url: unknown, init: unknown) => {
      const req = init as { headers: Record<string, string> };
      calls.push({ url: String(url), headers: req.headers });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'ok' } }],
        }),
      };
    }) as unknown as typeof fetch;

    const messages: ToolAugmentedMessage[] = [
      { role: 'system', content: 'system' },
      { role: 'user', content: 'find me a coworking desk' },
    ];
    await maybeEnrichWithSearchResults(
      supabase,
      'user-1',
      messages,
      'find me a coworking desk',
      CUSTOM_PROVIDER_ID,
      'my-finetune-7b',
      undefined,
      undefined,
      { toolEndpoint: 'https://models.example.org/v1/chat/completions', toolKey: '' }
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://models.example.org/v1/chat/completions');
    expect('Authorization' in calls[0]!.headers).toBe(false);
  });
});

describe('two no-auth servers both stay in the chain', () => {
  it('dedups on (url, key), not on the key alone', async () => {
    rows.push(
      ownServer({ id: 'a', key: '', baseUrl: 'https://one.example.org/v1', sortOrder: 0 }),
      ownServer({ id: 'b', key: '', baseUrl: 'https://two.example.org/v1', sortOrder: 1 })
    );
    const r = await resolve();
    expect(r.toolEndpoint).toBe('https://one.example.org/v1/chat/completions');
    expect(r.fallbacks).toHaveLength(1);
    expect(r.fallbacks[0]!.provider).toBe(CUSTOM_PROVIDER_ID);
  });
});
