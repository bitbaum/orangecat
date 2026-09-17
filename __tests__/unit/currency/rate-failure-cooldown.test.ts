// @vitest-environment jsdom — rates.ts gates the fetch on `typeof window`,
// so the browser path this pins only exists under a DOM.
/**
 * One unreachable /api/rates must cost one request, not one per price.
 *
 * `fetchPromise` collapsed CONCURRENT callers, but nothing stopped SEQUENTIAL
 * ones: a failed load leaves the cache empty, so `hasUsableRates()` stays false
 * and the next component to ask starts a fresh request. Observed in a browser
 * whose DNS was failing: 98 requests to /api/rates from a single page — a
 * retry storm at exactly the moment the endpoint could least afford one.
 */

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('rate failure cooldown', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('makes ONE request for many sequential callers while the endpoint is down', async () => {
    fetchMock.mockRejectedValue(new Error('ERR_NAME_NOT_RESOLVED'));
    const { currencyConverter } = await import('@/services/currency/rates');

    // Twenty prices on a page, each asking in turn (awaited, so the in-flight
    // dedupe cannot be what saves us).
    for (let i = 0; i < 20; i += 1) {
      await currencyConverter.getRates();
    }

    // The regression: this was 20.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('tries again once the cooldown has passed', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const { currencyConverter } = await import('@/services/currency/rates');

    await currencyConverter.getRates();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Still inside the window — no second request.
    vi.advanceTimersByTime(29_000);
    await currencyConverter.getRates();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Past it — the endpoint gets another chance, so a blip is not permanent.
    vi.advanceTimersByTime(2_000);
    await currencyConverter.getRates();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a success clears the cooldown rather than leaving it armed', async () => {
    const { currencyConverter, cache } = await import('@/services/currency/rates');

    fetchMock.mockRejectedValueOnce(new Error('blip'));
    await currencyConverter.getRates();

    vi.advanceTimersByTime(31_000);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { rates: { CHF: 64574 }, fetchedAt: Date.now() } }),
    });
    const rates = await currencyConverter.getRates();

    expect(rates?.btcToChf).toBe(64574);
    expect(cache.rates.BTC_CHF).toBe(64574);
  });
});
