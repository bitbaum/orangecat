/**
 * A user's own key must buy them the tools they are paying for.
 *
 * The bug this closes: `TOOL_CAPABLE_PROVIDERS = ['groq','openrouter']` decided
 * tool support by PROVIDER NAME, so a user on their own OpenAI, Together,
 * DeepSeek or xAI key — models that all speak OpenAI-style function calling —
 * was handed no tool definitions at all. No web search, no actions, just chat,
 * on the best model they could buy. The person paying most got the least
 * capable Cat.
 *
 * Two properties are asserted, and the second matters as much as the first:
 *
 *  1. A BYOK provider gets the tool loop, pointed at ITS OWN endpoint with ITS
 *     OWN key. Sending a user's OpenAI model id to OpenRouter with a platform
 *     key would be a different and worse bug than sending nothing.
 *  2. A model absent from our hand-maintained registry is ASKED, not refused.
 *     Reading the registry's silence as a denial reproduces the whole bug one
 *     layer down: the list is incomplete by construction, and a user can always
 *     bring a model nobody here has catalogued.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { maybeEnrichWithSearchResults } from '@/services/cat/tool-use';
import { declaredToolVerdict, toolPlanForModel } from '@/services/cat/tool-capability';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { ToolAugmentedMessage } from '@/services/cat/tool-use-types';

const supabase = {} as AnySupabaseClient;
const USER_ID = 'user-1';

const baseMessages: ToolAugmentedMessage[] = [
  { role: 'system', content: 'system' },
  { role: 'user', content: 'find me a coworking desk' },
];

const realFetch = global.fetch;
const realEnv = { ...process.env };

/** A router that stops immediately — we only care about WHERE it was called. */
function stoppingRouter() {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'ok' } }],
    }),
  }));
}

afterEach(() => {
  global.fetch = realFetch;
  process.env = { ...realEnv };
  vi.restoreAllMocks();
});

describe('what the registry is allowed to say', () => {
  it('never turns an uncatalogued model into a denial', () => {
    // The trap: reading "no flag" as "no tools" refuses every model the list
    // has never heard of, WITHOUT EVER ASKING — which is the original bug.
    expect(declaredToolVerdict('some-vendor/brand-new-model-nobody-catalogued')).toBe('unobserved');
    expect(declaredToolVerdict(null)).toBe('unobserved');
    expect(declaredToolVerdict(undefined)).toBe('unobserved');
  });

  it('asks an unknown model rather than refusing it', () => {
    const plan = toolPlanForModel('some-vendor/brand-new-model');
    expect(plan.sendTools).toBe(true);
    expect(plan.isLearning).toBe(true);
  });
});

describe('a BYOK user gets the tool loop', () => {
  it('calls THEIR vendor with THEIR key, not the platform fallback', async () => {
    const calls: Array<{ url: string; auth: string }> = [];
    global.fetch = vi.fn(async (url: unknown, init: unknown) => {
      const req = init as { headers: Record<string, string> };
      calls.push({ url: String(url), auth: req.headers.Authorization });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'ok' } }],
        }),
      };
    }) as unknown as typeof fetch;

    // A platform key exists, and must NOT be the one used.
    process.env.OPENROUTER_API_KEY = 'platform-key-must-not-be-used';

    await maybeEnrichWithSearchResults(
      supabase,
      USER_ID,
      baseMessages,
      'find me a coworking desk',
      // Before this change, ANY provider outside the two-name list returned
      // the messages untouched and never called anything at all.
      'openai',
      'gpt-5.2',
      undefined,
      undefined,
      {
        toolEndpoint: 'https://api.openai.com/v1/chat/completions',
        toolKey: 'sk-the-users-own-key',
      }
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(calls[0]!.auth).toBe('Bearer sk-the-users-own-key');
    expect(calls[0]!.auth).not.toContain('platform-key');
  });

  it('serves the platform vendors through the same one path', async () => {
    // The platform is not a special case any more: the resolver supplies its
    // endpoint and key exactly as it does for a BYOK step, so there is one
    // code path rather than a privileged branch beside a fallback.
    const calls: string[] = [];
    global.fetch = vi.fn(async (url: unknown) => {
      calls.push(String(url));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'ok' } }],
        }),
      };
    }) as unknown as typeof fetch;

    await maybeEnrichWithSearchResults(
      supabase,
      USER_ID,
      baseMessages,
      'find me a desk',
      'openrouter',
      'nvidia/nemotron-3-super-120b-a12b:free',
      undefined,
      undefined,
      {
        toolEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
        toolKey: 'platform-key',
      }
    );

    expect(calls).toEqual(['https://openrouter.ai/api/v1/chat/completions']);
  });

  it('reads the credentials off the ACTIVE step, not off chain[0]', () => {
    // A metered frontier request REPLACES the primary wholesale and leaves the
    // rest of the chain as its fallbacks. Reading chain[0] there would point
    // the tool loop at whatever vendor the user configured first, with that
    // vendor's key, while the answer itself came from platform OpenRouter.
    const src = readFileSync(
      join(__dirname, '../../../src/services/cat/provider-resolver.ts'),
      'utf8'
    );
    expect(src).toContain('toolEndpoint: primary?.toolEndpoint ?? null');
    expect(src).not.toContain('chain[0]?.toolEndpoint');
    // And the replacement step must carry its own pair rather than inherit one.
    expect(src).toMatch(/metered = true;/);
    const meteredBlock = src.slice(
      src.indexOf('primary = {', src.indexOf('isPlatformMeteredModel'))
    );
    expect(meteredBlock.slice(0, 800)).toContain('toolEndpoint:');
  });

  it('gives every platform vendor its OWN endpoint, including local Ollama', async () => {
    // The platform chain is not just Groq and OpenRouter: it also carries
    // Together and a LOCAL Ollama. A provider-name mapping that handled only
    // the two obvious ones would post a Together model id to OpenRouter, and a
    // LOCAL model to a paid vendor — each with the wrong key. So the function
    // that already picked the url and key publishes the pair, and nothing
    // downstream re-derives it.
    process.env.GROQ_API_KEY = 'groq-key';
    process.env.OPENROUTER_API_KEY = 'or-key';
    process.env.TOGETHER_API_KEY = 'together-key';
    process.env.PLATFORM_OLLAMA_URL = 'http://127.0.0.1:11434/v1';

    const { buildPlatformProviders } = await import('@/services/ai/platform-providers');
    const byProvider = new Map(
      buildPlatformProviders('hello').map(p => [p.providerId, p] as const)
    );

    for (const [id, p] of byProvider) {
      // Every step must name a host consistent with its own vendor.
      expect(p.toolEndpoint, `${id} endpoint`).toMatch(/^https?:\/\//);
      expect(p.toolEndpoint, `${id} endpoint`).toMatch(/\/chat\/completions$/);
      expect(p.toolKey, `${id} key`).toBeTruthy();
    }

    const ollama = byProvider.get('ollama');
    if (ollama) {
      // The one that would hurt most: a local model id sent to a paid vendor.
      expect(ollama.toolEndpoint).toContain('127.0.0.1:11434');
      expect(ollama.toolEndpoint).not.toContain('openrouter');
    }
    const together = byProvider.get('together');
    if (together) {
      expect(together.toolEndpoint).toContain('together');
      expect(together.toolKey).toBe('together-key');
    }
  });

  it('NEVER guesses an endpoint when the resolver supplied none', async () => {
    // The failure that would be worse than no tools: sending a user's own model
    // id to a vendor that never heard of it, with somebody else's key. Env vars
    // are deliberately present here — they must not be reached for.
    const fetchImpl = stoppingRouter();
    global.fetch = fetchImpl as unknown as typeof fetch;
    process.env.OPENROUTER_API_KEY = 'platform-key';
    process.env.GROQ_API_KEY = 'platform-groq-key';

    for (const provider of ['together', 'openrouter', 'groq']) {
      const out = await maybeEnrichWithSearchResults(
        supabase,
        USER_ID,
        baseMessages,
        'find me a desk',
        provider,
        'some/model',
        undefined,
        undefined,
        { actorId: null }
      );
      expect(out).toEqual(baseMessages);
    }

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
