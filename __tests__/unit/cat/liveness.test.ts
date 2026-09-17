/**
 * `callPlatformJson` sits behind eight Cat features, every one of which
 * degrades to null on failure — so a dead chain looks exactly like a quiet
 * afternoon, and `/api/health` carries no AI field to contradict that. It has
 * been dead twice: a retired model id, and an empty 200 returned as an answer.
 *
 * ai-kit owns the gating, the caching and the never-cache-a-failure rule and
 * tests them there. What is app-specific, and what these hold, is the WIRING:
 * an ordinary poll is free, the gate is really connected to AI_PROBE_SECRET,
 * and the probe calls the REAL `callPlatformJson` rather than a private chain
 * assembled for it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Each test loads the module FRESH.
 *
 * The handler is a module-level singleton — the probe's cache lives inside it —
 * and a success is cached for ten minutes. Sharing one instance would let the
 * first success answer every later case, so the failure tests would read 200
 * and pass for the wrong reason. That cache is a safety property worth
 * keeping: it is what stops a monitor in a retry loop draining the free pool
 * the Cat runs on.
 */
async function loadHandler() {
  vi.resetModules();
  return (await import('@/services/cat/liveness')).catLivenessHandler;
}

const ORIGINAL_ENV = { ...process.env };

/** Built PER CALL: one Response body can be read only once. */
function completion(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.GROQ_API_KEY = 'gsk_test';
  process.env.OPENROUTER_API_KEY = 'sk-or-test';
  delete process.env.AI_PROBE_SECRET;
  fetchMock = vi.fn(async () => completion('{"colour":"blue"}'));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
});

describe('GET /api/health/ai', () => {
  it('an ordinary poll costs nothing', async () => {
    const handler = await loadHandler();
    const res = await handler(new Request('https://oc.test/api/health/ai'));

    expect(res.status).toBe(200);
    expect((await res.json()).probed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to probe without the secret, and spends nothing while refusing', async () => {
    process.env.AI_PROBE_SECRET = 'right';
    const handler = await loadHandler();

    expect((await handler(new Request('https://oc.test/api/health/ai?probe=1'))).status).toBe(401);
    expect(
      (await handler(new Request('https://oc.test/api/health/ai?probe=1&secret=nope'))).status
    ).toBe(401);

    // The point of the gate is the SPEND, not the status code.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('with AI_PROBE_SECRET unset, probing is OFF (501) rather than open', async () => {
    const handler = await loadHandler();
    const res = await handler(new Request('https://oc.test/api/health/ai?probe=1&secret=anything'));

    expect(res.status).toBe(501);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('probes the REAL platform chain and returns what it said', async () => {
    process.env.AI_PROBE_SECRET = 'right';
    const handler = await loadHandler();

    const res = await handler(new Request('https://oc.test/api/health/ai?probe=1&secret=right'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.answer).toContain('blue');
    // Groq is this chain's first link — the probe went down the real path.
    expect(String(fetchMock.mock.calls[0][0])).toContain('groq');
  });

  it('a dead chain is 503 — the silence eight features degrade into', async () => {
    process.env.AI_PROBE_SECRET = 'right';
    fetchMock.mockImplementation(async () => new Response('boom', { status: 500 }));
    const handler = await loadHandler();

    const res = await handler(new Request('https://oc.test/api/health/ai?probe=1&secret=right'));

    expect(res.status).toBe(503);
  });

  it('an EMPTY 200 is a failure — the second way this chain died', async () => {
    process.env.AI_PROBE_SECRET = 'right';
    fetchMock.mockImplementation(async () => completion(''));
    const handler = await loadHandler();

    const res = await handler(new Request('https://oc.test/api/health/ai?probe=1&secret=right'));

    // `content ?? null` used to hand "" back as the model's output, and the
    // loop returned on the first res.ok so nothing fell through. That is the
    // exact shape this must refuse.
    expect(res.status).toBe(503);
  });

  it('no platform key configured is 503, not a cheerful 200', async () => {
    process.env.AI_PROBE_SECRET = 'right';
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    const handler = await loadHandler();

    const res = await handler(new Request('https://oc.test/api/health/ai?probe=1&secret=right'));

    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
