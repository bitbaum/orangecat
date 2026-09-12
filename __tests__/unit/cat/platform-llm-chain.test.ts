/**
 * `callPlatformJson` is the single call behind eight Cat features — the offer
 * engine, both writing engines, prompt suggestions, platform feedback, image
 * suggestions, the voice intent router, and the Cat's replies.
 *
 * It has been silently dead twice. Once when Groq stopped serving the pinned
 * `llama-3.3-70b-versatile`, and once by construction: it returned
 * `json.choices?.[0]?.message?.content ?? null`, which looks like a guard and
 * is not — `??` only catches null/undefined, so an EMPTY STRING was returned as
 * the model's output. And because the loop `return`ed on the first
 * `response.ok`, an empty completion never fell through to OpenRouter. Every
 * caller then got `parseJsonLoose('') === null` and "degraded gracefully" into
 * doing nothing, with nothing in the logs to say why.
 *
 * Both failures were invisible for the same reason: nothing here was tested.
 * These drive every case through a real response, because the response is what
 * the code was misreading.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const ORIGINAL_ENV = { ...process.env };

/** Built PER CALL: one Response body can be read only once. */
function completion(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

function vendors(): string[] {
  return fetchMock.mock.calls.map(([url]) =>
    String(url).includes('groq') ? 'groq' : 'openrouter'
  );
}

beforeEach(() => {
  process.env.GROQ_API_KEY = 'gsk_test';
  process.env.OPENROUTER_API_KEY = 'sk-or-test';
  fetchMock = vi.fn(async () => completion('{"ok":true}'));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe('callPlatformJson', () => {
  it('returns the first link that answers', async () => {
    const { callPlatformJson } = await import('@/services/cat/platform-llm');

    await expect(callPlatformJson('sys', 'user')).resolves.toBe('{"ok":true}');
    expect(vendors()[0]).toBe('groq');
  });

  it('an EMPTY 200 falls through to OpenRouter instead of being the answer', async () => {
    // The bug, exactly: `content ?? null` returns "" for an empty completion,
    // and the old loop returned on the first `response.ok`, so OpenRouter was
    // never asked. Eight features went quiet on a 200.
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('groq') ? completion('') : completion('{"from":"openrouter"}')
    );
    const { callPlatformJson } = await import('@/services/cat/platform-llm');

    await expect(callPlatformJson('sys', 'user')).resolves.toBe('{"from":"openrouter"}');
    expect(vendors()).toContain('openrouter');
  });

  it('a retired model id at Groq falls through, the failure this file already suffered', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('groq')
        ? new Response('{"error":{"code":"model_not_found"}}', { status: 404 })
        : completion('{"from":"openrouter"}')
    );
    const { callPlatformJson } = await import('@/services/cat/platform-llm');

    await expect(callPlatformJson('sys', 'user')).resolves.toBe('{"from":"openrouter"}');
  });

  it('retries WITHOUT response_format when a model rejects the flag', async () => {
    // Some free models 400 on `response_format`. The system prompt already
    // demands JSON-only output, so the retry is what keeps those models usable
    // rather than dropping them from the pool.
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { response_format?: unknown };
      return body.response_format
        ? new Response('{"error":"response_format unsupported"}', { status: 400 })
        : completion('{"plain":true}');
    });
    const { callPlatformJson } = await import('@/services/cat/platform-llm');

    await expect(callPlatformJson('sys', 'user')).resolves.toBe('{"plain":true}');
  });

  it('a DAILY 429 at Groq crosses to OpenRouter and asks Groq only once', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('groq')
        ? new Response(
            JSON.stringify({
              error: {
                message: 'Rate limit reached for model per day. Limit 100000, used 100000.',
              },
            }),
            { status: 429 }
          )
        : completion('{"from":"openrouter"}')
    );
    const { callPlatformJson } = await import('@/services/cat/platform-llm');

    await expect(callPlatformJson('sys', 'user')).resolves.toBe('{"from":"openrouter"}');
    expect(vendors().filter(v => v === 'groq')).toHaveLength(1);
  });

  it('sends the OpenRouter attribution header', async () => {
    const { callPlatformJson } = await import('@/services/cat/platform-llm');

    await callPlatformJson('sys', 'user');

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)['HTTP-Referer']).toBeTruthy();
  });

  it('returns null when every link fails, rather than throwing at the caller', async () => {
    fetchMock.mockImplementation(async () => new Response('boom', { status: 500 }));
    const { callPlatformJson } = await import('@/services/cat/platform-llm');

    // Callers all degrade gracefully on null; a throw here would surface as a
    // 500 in features that are meant to be optional.
    await expect(callPlatformJson('sys', 'user')).resolves.toBeNull();
  });

  it('makes no request at all when no platform key is configured', async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const { callPlatformJson, hasPlatformProviders } = await import('@/services/cat/platform-llm');

    expect(hasPlatformProviders()).toBe(false);
    await expect(callPlatformJson('sys', 'user')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hasPlatformProviders reads the env at CALL time, not at import', async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const { hasPlatformProviders } = await import('@/services/cat/platform-llm');
    expect(hasPlatformProviders()).toBe(false);

    // Next's build evaluates module scope without the runtime's env; a value
    // frozen there would report "not configured" forever on a box that is.
    process.env.GROQ_API_KEY = 'gsk_test';
    expect(hasPlatformProviders()).toBe(true);
  });
});

describe('callPlatformJson and JSON mode as a per-model capability', () => {
  /** The body ai-kit actually sent, per call. */
  function bodies(): Array<Record<string, unknown>> {
    return fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
  }

  it('never sends response_format to a model that rejects it', async () => {
    // Groq's openai/gpt-oss-120b answers 400 json_validate_failed for EVERY
    // request carrying the flag, so sending it is a guaranteed wasted
    // round-trip in front of every structured Cat feature.
    const { callPlatformJson } = await import('@/services/cat/platform-llm');

    await expect(callPlatformJson('sys', 'user')).resolves.toBe('{"ok":true}');

    expect(vendors()).toEqual(['groq']);
    expect(bodies()[0].response_format).toBeUndefined();
  });

  it('still answers on the leader rather than spending the OpenRouter pool', async () => {
    // Dropping the flag, not the model: Groq has the larger daily budget, so a
    // fix that reordered the chain would trade one wasted call for a quota.
    const { callPlatformJson } = await import('@/services/cat/platform-llm');

    await callPlatformJson('sys', 'user');

    expect(vendors()).not.toContain('openrouter');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not repeat an identical call when the first pass carried no flag', async () => {
    // The retry-without-the-flag only differs from the first pass if the first
    // pass had the flag. Without this, a Groq-led chain called every provider
    // twice with byte-identical bodies.
    fetchMock.mockImplementation(async () => new Response('nope', { status: 500 }));
    const { callPlatformJson } = await import('@/services/cat/platform-llm');

    await expect(callPlatformJson('sys', 'user')).resolves.toBeNull();

    // One pass over both links, not two.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('learns a rejection it has not seen before, and stops paying for it', async () => {
    // A model that starts refusing the flag should cost one failure, not one
    // per call until somebody reads the logs.
    vi.resetModules();
    let seen = 0;
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).includes('openrouter')) {
        seen += 1;
        if (seen === 1) {
          return new Response(
            JSON.stringify({
              error: { code: 'json_validate_failed', message: 'Failed to validate JSON.' },
            }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }
      }
      return completion('{"ok":true}');
    });

    const { callPlatformJson } = await import('@/services/cat/platform-llm');
    // Groq answers first and never carries the flag, so reach OpenRouter by
    // making Groq unavailable for this pair of calls.
    delete process.env.GROQ_API_KEY;

    await callPlatformJson('sys', 'user');
    const first = fetchMock.mock.calls.length;
    fetchMock.mockClear();
    await callPlatformJson('sys', 'user');

    expect(first).toBeGreaterThan(1); // the rejection cost a retry, once
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)).response_format
    ).toBeUndefined();
  });
});
