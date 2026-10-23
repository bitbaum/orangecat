/**
 * The nightly Cat eval used to die on a self-healing infrastructure blip.
 *
 * PostgREST reloads its schema cache in the background and, while that is in
 * flight, answers `503 PGRST002` — a body that literally says "Retrying.". On
 * 2026-08-04 one of those landed inside resetDailyCap, scripts/eval-cat.mjs had
 * no retry, and the whole entity-type judgment gate reported failed. A gate
 * that reports red because a cache warmed up is worse than no gate: it trains
 * you to ignore it.
 *
 * This is the contract that keeps the retry in place. It runs the real module
 * against a real HTTP server rather than asserting on source text, because the
 * thing worth protecting is the behaviour, not the presence of a keyword.
 */

import { execFileSync } from 'child_process';
import path from 'path';

/**
 * Run a probe in a child process: eval-cat.mjs is ESM with module-load-time env
 * reads, so the env has to exist before the import — which a child gives us
 * cleanly. The child prints one JSON line; failures surface as a non-zero exit
 * with stderr attached.
 */
function probe(script: string): { result: unknown; calls: number; error?: string } {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30_000,
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  return JSON.parse(out.trim().split('\n').pop()!);
}

const MODULE_URL = `file://${path.join(process.cwd(), 'scripts/eval-cat.mjs')}`;

/** Boilerplate: a server whose Nth response is scripted, then import + call. */
function harness(responses: Array<{ status: number; body: string }>): string {
  return `
    import http from 'node:http';
    const responses = ${JSON.stringify(responses)};
    let calls = 0;
    const server = http.createServer((req, res) => {
      const r = responses[Math.min(calls, responses.length - 1)];
      calls++;
      res.writeHead(r.status, { 'content-type': 'application/json' });
      res.end(r.body);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address();
    process.env.SUPABASE_URL = 'http://127.0.0.1:' + port;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:' + port;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    // Set the anon key too. eval-cat.mjs exits early unless URL + ANON + SERVICE
    // are all present, and it falls back to reading .env.local from cwd — which
    // a git worktree does not have (the file is untracked and lives only in the
    // main checkout). Relying on that fallback made this suite pass or fail
    // based on where it was run rather than on the retry logic under test.
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    const { rest } = await import('${MODULE_URL}');
    let result = null, error;
    try { result = await rest('GET', 'probe'); }
    catch (e) { error = String(e.message || e); }
    server.close();
    console.log(JSON.stringify({ result, calls, error }));
  `;
}

const SCHEMA_CACHE_503 = {
  status: 503,
  body: '{"code":"PGRST002","message":"Could not query the database for the schema cache. Retrying."}',
};
const OK = { status: 200, body: '[{"ok":true}]' };

describe('eval-cat.mjs PostgREST retry', () => {
  it('survives the transient 503 that killed the 2026-08-04 run', () => {
    const { result, calls, error } = probe(harness([SCHEMA_CACHE_503, SCHEMA_CACHE_503, OK]));

    expect(error).toBeUndefined();
    expect(result).toEqual([{ ok: true }]);
    expect(calls).toBe(3); // two blips absorbed, third attempt served
  }, 40_000);

  it('still fails loudly when the 503 never clears', () => {
    const { calls, error } = probe(harness([SCHEMA_CACHE_503]));

    // Retrying forever would hang the nightly timer — the bound matters as much
    // as the retry. Four attempts, then a real error naming the status.
    expect(calls).toBe(4);
    expect(error).toMatch(/503/);
  }, 40_000);

  it('does not retry a 4xx — that is a verdict about the request, not a blip', () => {
    const { calls, error } = probe(
      harness([{ status: 400, body: '{"message":"malformed filter"}' }])
    );

    expect(calls).toBe(1);
    expect(error).toMatch(/400/);
  }, 40_000);

  it('importing the module does not start a run', () => {
    // The direct-invocation guard: without it, importing eval-cat.mjs anywhere
    // (this test, a future helper) would fire a real eval against production.
    const { result, calls } = probe(harness([OK]));

    expect(result).toEqual([{ ok: true }]);
    expect(calls).toBe(1); // a started run would have made many more requests
  }, 40_000);
});
