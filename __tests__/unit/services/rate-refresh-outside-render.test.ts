/**
 * A background rate refresh must not be attributed to the render that asked
 * for it.
 *
 * `fetchUpstream` uses `cache: 'no-store'`, and Next tracks every fetch started
 * during a render. `getCachedRateSnapshot` is explicitly the "never wait on a
 * third party to paint" path — nothing awaits its refresh — but starting the
 * fetch synchronously still put it inside the render's async context, and Next
 * reclassified the route. Production, 2026-08-28:
 *
 *   Error: Page changed from static to dynamic at runtime /discover,
 *   reason: revalidate: 0 fetch https://api.coingecko.com/... /discover
 *
 * So the property under test is about TIMING, not about whether the refresh
 * happens: the read must return without any fetch having begun, and the fetch
 * must begin afterwards.
 */

import {
  getCachedRateSnapshot,
  getRateSnapshot,
  __setSnapshotForTests,
} from '@/services/currency/rateSource.server';

import type { Mock } from 'vitest';

const MINUTE = 60_000;

describe('getCachedRateSnapshot refresh timing', () => {
  let fetchMock: Mock;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ bitcoin: { chf: 52199, usd: 58000, eur: 55000, gbp: 47000 } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    __setSnapshotForTests(null);
  });

  afterEach(() => {
    __setSnapshotForTests(null);
    vi.useRealTimers();
  });

  it('starts no fetch synchronously when the snapshot is stale', () => {
    __setSnapshotForTests({ rates: { CHF: 52199 }, fetchedAt: Date.now() - 5 * MINUTE });

    const snap = getCachedRateSnapshot();

    // Stale but usable: served immediately, and crucially nothing has hit the
    // network yet — that is what keeps the route static.
    expect(snap?.rates.CHF).toBe(52199);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('starts no fetch synchronously when the snapshot is too old to use', () => {
    __setSnapshotForTests({ rates: { CHF: 52199 }, fetchedAt: Date.now() - 60 * MINUTE });

    expect(getCachedRateSnapshot()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('warms a cold process instead of staying empty forever', () => {
    // Every deploy starts here. This used to return null and schedule nothing,
    // so rates stayed absent until some other caller awaited them.
    expect(getCachedRateSnapshot()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves a fresh snapshot without scheduling anything', () => {
    __setSnapshotForTests({ rates: { CHF: 52199 }, fetchedAt: Date.now() });

    expect(getCachedRateSnapshot()?.rates.CHF).toBe(52199);
    vi.runOnlyPendingTimers();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Production 2026-08-28: this module reached a client chunk through a
  // transitive import and the browser called CoinGecko directly on page load —
  // 534ms in the critical path and every visitor's IP handed to a third party.
  // The import graph is being repaired separately; this refuses regardless.
  it('never calls out when it finds itself running in a browser', async () => {
    // Start from nothing cached, or a snapshot left by an earlier test would
    // be served before the fetch is ever attempted and prove nothing.
    __setSnapshotForTests(null);

    // A browser bundle has no Node version record, even where `process.env`
    // has been shimmed. jsdom's `window` is NOT the discriminator — it is
    // present in this very test.
    const versions = process.versions;
    Object.defineProperty(process, 'versions', { value: {}, configurable: true });
    try {
      await expect(getRateSnapshot()).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, 'versions', { value: versions, configurable: true });
    }
  });
});
