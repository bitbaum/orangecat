/**
 * One balance fetcher; its errors are the codes callers check for. The old
 * one threw "Mempool API error: 429", which matched none of them, so a rate
 * limit read as a network failure.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAddressBalance } from '@/lib/bitcoin/addressBalance';

const reply = (status: number, body: unknown = {}) =>
  vi.fn(async () => ({ status, ok: status < 400, json: async () => body }));

afterEach(() => vi.restoreAllMocks());

describe('fetchAddressBalance', () => {
  it('counts unconfirmed funds and returns BTC, never from a cache', async () => {
    const fetchMock = reply(200, {
      chain_stats: { funded_txo_sum: 150_000, spent_txo_sum: 50_000, tx_count: 2 },
      mempool_stats: { funded_txo_sum: 20_000, spent_txo_sum: 0, tx_count: 1 },
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const result = await fetchAddressBalance('bc1qexample');
    expect(result.balance_btc).toBeCloseTo(0.0012);
    expect(result.tx_count).toBe(3);
    expect((fetchMock.mock.calls[0] as unknown[])[1]).toMatchObject({ cache: 'no-store' });
  });

  it('reports a rate limit as RATE_LIMITED', async () => {
    global.fetch = reply(429) as unknown as typeof fetch;
    await expect(fetchAddressBalance('bc1q')).rejects.toThrow('RATE_LIMITED');
  });

  it('reports other failures as API_ERROR_<status>', async () => {
    global.fetch = reply(503) as unknown as typeof fetch;
    await expect(fetchAddressBalance('bc1q')).rejects.toThrow('API_ERROR_503');
  });
});
