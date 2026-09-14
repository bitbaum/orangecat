/**
 * Adding "your own endpoint" — the server-side gate.
 *
 * The URL is fetched from OrangeCat's server, so it gets the same SSRF policy
 * as a webhook target, and it is validated against `${baseUrl}/models` — the
 * one route every OpenAI-compatible server answers — with the model list
 * filling in a default the user did not name.
 */
import { ApiKeyService } from '@/services/ai/api-key-service';
import { CUSTOM_PROVIDER_ID } from '@/data/aiProviders';
import type { AnySupabaseClient } from '@/lib/supabase/types';

const realFetch = global.fetch;
const realEnv = { ...process.env };

/** Records the inserted row; every other call succeeds and returns nothing. */
function fakeSupabase(inserted: Record<string, unknown>[]) {
  const insertChain = (row: Record<string, unknown>) => {
    inserted.push(row);
    const result = { data: { id: 'k1', ...row }, error: null };
    return { select: () => ({ single: async () => result }) };
  };
  const updateChain = { eq: () => updateChain, then: (r: (v: unknown) => void) => r({}) };
  return {
    from: () => ({
      insert: insertChain,
      update: () => updateChain,
    }),
  } as unknown as AnySupabaseClient;
}

function modelsResponse(ids: string[], status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ data: ids.map(id => ({ id })) }),
  };
}

beforeEach(() => {
  process.env.API_KEY_ENCRYPTION_SECRET = 'test-secret-for-byok-tests';
});

afterEach(() => {
  global.fetch = realFetch;
  process.env = { ...realEnv };
  vi.restoreAllMocks();
});

const base = { userId: 'u1', provider: CUSTOM_PROVIDER_ID, keyName: 'Home box', apiKey: '' };

describe('the URL is gated before anything is fetched', () => {
  it.each([
    'http://localhost:11434/v1',
    'http://127.0.0.1:8000/v1',
    'http://10.0.0.5:8000/v1',
    'http://192.168.1.20:1234/v1',
    'http://169.254.169.254/v1',
  ])('refuses %s and never fetches', async baseUrl => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const inserted: Record<string, unknown>[] = [];
    const svc = new ApiKeyService(fakeSupabase(inserted));

    const out = await svc.addKey({ ...base, baseUrl });

    expect(out.success).toBe(false);
    expect(out.error).toMatch(/cannot be used from OrangeCat's server/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it('refuses a custom row with no URL at all', async () => {
    const svc = new ApiKeyService(fakeSupabase([]));
    const out = await svc.addKey({ ...base });
    expect(out.success).toBe(false);
    expect(out.error).toMatch(/Base URL is required/);
  });
});

describe('validation talks to the user server, not to a vendor', () => {
  it('GETs {baseUrl}/models with no Authorization when the key is empty', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    global.fetch = vi.fn(async (url: unknown, init: unknown) => {
      calls.push({
        url: String(url),
        headers: (init as { headers: Record<string, string> }).headers,
      });
      return modelsResponse(['qwen-finetune']);
    }) as unknown as typeof fetch;
    const inserted: Record<string, unknown>[] = [];
    const svc = new ApiKeyService(fakeSupabase(inserted));

    const out = await svc.addKey({ ...base, baseUrl: 'https://203.0.113.10/v1/' });

    expect(out.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://203.0.113.10/v1/models');
    expect('Authorization' in calls[0]!.headers).toBe(false);
    // Trailing slash normalised away so `${base_url}/chat/completions` never doubles it.
    expect(inserted[0]!.base_url).toBe('https://203.0.113.10/v1');
    expect(inserted[0]!.provider).toBe(CUSTOM_PROVIDER_ID);
  });

  it('sends the bearer when a key is given', async () => {
    let auth: string | undefined;
    global.fetch = vi.fn(async (_url: unknown, init: unknown) => {
      auth = (init as { headers: Record<string, string> }).headers.Authorization;
      return modelsResponse(['m']);
    }) as unknown as typeof fetch;
    const svc = new ApiKeyService(fakeSupabase([]));

    await svc.addKey({ ...base, apiKey: 'tok-abc', baseUrl: 'https://203.0.113.10/v1' });

    expect(auth).toBe('Bearer tok-abc');
  });

  it('fills the default model from the server list when the user named none', async () => {
    global.fetch = vi.fn(async () =>
      modelsResponse(['first-listed', 'second'])
    ) as unknown as typeof fetch;
    const inserted: Record<string, unknown>[] = [];
    const svc = new ApiKeyService(fakeSupabase(inserted));

    await svc.addKey({ ...base, baseUrl: 'https://203.0.113.10/v1' });

    expect(inserted[0]!.default_model).toBe('first-listed');
  });

  it('keeps the model the user named over the server list', async () => {
    global.fetch = vi.fn(async () => modelsResponse(['first-listed'])) as unknown as typeof fetch;
    const inserted: Record<string, unknown>[] = [];
    const svc = new ApiKeyService(fakeSupabase(inserted));

    await svc.addKey({ ...base, baseUrl: 'https://203.0.113.10/v1', defaultModel: 'mine' });

    expect(inserted[0]!.default_model).toBe('mine');
  });

  it('refuses when neither the user nor the server names a model', async () => {
    global.fetch = vi.fn(async () => modelsResponse([])) as unknown as typeof fetch;
    const inserted: Record<string, unknown>[] = [];
    const svc = new ApiKeyService(fakeSupabase(inserted));

    const out = await svc.addKey({ ...base, baseUrl: 'https://203.0.113.10/v1' });

    expect(out.success).toBe(false);
    expect(out.error).toMatch(/lists no models/);
    expect(inserted).toHaveLength(0);
  });

  it('explains a 404 as a wrong base path, not a bad key', async () => {
    global.fetch = vi.fn(async () => modelsResponse([], 404)) as unknown as typeof fetch;
    const svc = new ApiKeyService(fakeSupabase([]));

    const out = await svc.addKey({ ...base, baseUrl: 'https://203.0.113.10' });

    expect(out.success).toBe(false);
    expect(out.error).toMatch(/\/v1/);
  });
});
