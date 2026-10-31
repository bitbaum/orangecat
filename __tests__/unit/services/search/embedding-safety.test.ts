import { embedTexts, EMBEDDINGS_DIM } from '@/services/ai/embeddings';
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn() } }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('embedding provider boundary', () => {
  it('bounds provider latency and rejects malformed vectors without losing valid rows', async () => {
    vi.stubEnv('EMBEDDINGS_API_KEY', 'review-test-key');
    const valid = Array.from({ length: EMBEDDINGS_DIM }, () => 0.1);
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          null,
          { index: 99, embedding: valid },
          { index: 0, embedding: [0.1] },
          { index: 1, embedding: valid },
          { index: 2, embedding: valid.map((v, i) => (i ? v : NaN)) },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetcher);
    expect(await embedTexts(['short', 'valid', 'nonfinite'])).toEqual([null, valid, null]);
    const signal = fetcher.mock.calls[0][1].signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
  });
  it('fails to keyword search when the provider request aborts', async () => {
    vi.stubEnv('EMBEDDINGS_API_KEY', 'review-test-key');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('Timed out', 'TimeoutError'))
    );
    expect(await embedTexts(['query'])).toEqual([null]);
  });
});
