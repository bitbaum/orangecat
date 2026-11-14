/**
 * Embeddings reach the server's usage log too (src/services/ai/embeddings.ts).
 * They go to OpenAI by default, a vendor that bills per call, so leaving them
 * out would hide exactly the spend the AI card exists to show.
 */
import { vi } from 'vitest';
import { setUsageSink, type UsageEvent } from '@bitbaum/ai-kit';

vi.mock('@/services/ai/vendor-spend-cap', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/ai/vendor-spend-cap')>();
  return { ...real, reservePlatformCall: vi.fn(async () => undefined) };
});

import { embedTexts } from '@/services/ai/embeddings';
import { reservePlatformCall, VendorCapReached } from '@/services/ai/vendor-spend-cap';

let seen: UsageEvent[] = [];
const env = { ...process.env };

beforeEach(() => {
  seen = [];
  setUsageSink(e => {
    seen.push(e);
  });
  process.env.EMBEDDINGS_API_KEY = 'sk-test';
  delete process.env.EMBEDDINGS_BASE_URL;
});
afterEach(() => {
  setUsageSink(null);
  vi.unstubAllGlobals();
  process.env = { ...env };
});

it('an answered call is one served line at the vendor, marked paid', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ data: [{ index: 0, embedding: [1, 2] }] })))
  );
  expect(await embedTexts(['hello'])).toEqual([[1, 2]]);
  expect(seen).toHaveLength(1);
  expect(seen[0]).toMatchObject({
    app: 'ORANGECAT',
    provider: 'openai',
    outcome: 'served',
    paid: true,
  });
});

it('a refusal at the vendor and a network failure are failed lines', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('slow down', { status: 429 }))
  );
  await embedTexts(['a']);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Promise.reject(new Error('offline')))
  );
  await embedTexts(['b']);
  expect(seen.map(e => [e.outcome, e.status])).toEqual([
    ['failed', 429],
    ['failed', undefined],
  ]);
});

it('a call the daily cap stopped is not called, and nothing is sent', async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  vi.mocked(reservePlatformCall).mockRejectedValueOnce(new VendorCapReached('openai'));
  expect(await embedTexts(['c'])).toEqual([null]);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(seen[0]).toMatchObject({ outcome: 'refused', reason: 'vendor-cap' });
});

it('a server on this machine is not a vendor and writes no line', async () => {
  process.env.EMBEDDINGS_BASE_URL = 'http://127.0.0.1:11434/v1';
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ data: [{ index: 0, embedding: [3] }] })))
  );
  await embedTexts(['local']);
  expect(seen).toHaveLength(0);
});
