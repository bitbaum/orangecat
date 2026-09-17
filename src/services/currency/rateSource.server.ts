/**
 * The one place that asks the outside world what Bitcoin costs.
 *
 * Everything else in the app reads the snapshot this module holds. That matters
 * because a BTC/fiat rate is not decoration — it decides how much Bitcoin
 * actually leaves a payer's wallet for a price written in francs. A rate that is
 * merely *plausible* is the most dangerous kind: it passes every "is this a
 * number" check and silently mis-prices real money.
 *
 * So the contract here is deliberately blunt:
 *
 *   A rate is either real and recent, or it does not exist.
 *
 * There are no seeded defaults and no fallback constants. When we cannot reach
 * the upstream, callers get `null` and must degrade honestly (show Bitcoin,
 * refuse to price an invoice) rather than transact against a guess. The previous
 * design fell back to 86,000 CHF/BTC; the real rate was 52,199, so every
 * fiat-priced sale would have minted an invoice worth ~39% less than the seller
 * asked for, with nothing on screen to say so.
 *
 * Freshness has two thresholds, because "slightly old" and "no idea" are
 * different states:
 *   - under FRESH_MS      → serve as-is, no upstream call
 *   - under MAX_AGE_MS    → serve, and refresh in the background
 *   - beyond MAX_AGE_MS   → treat as absent
 *
 * Server-side only. Browsers read /api/rates instead, which keeps the rate on
 * one origin (no third-party connect-src) and collapses one upstream call per
 * visitor into one per minute for the whole platform.
 */

import { logger } from '@/utils/logger';

/** BTC price per fiat unit code, e.g. `{ CHF: 52199 }`. */
export interface RateSnapshot {
  rates: Readonly<Record<string, number>>;
  fetchedAt: number;
}

/** Fiat we ask upstream for. Must stay a subset of CURRENCY_CODES. */
const UPSTREAM_CURRENCIES = ['chf', 'usd', 'eur', 'gbp'] as const;

const SOURCE_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=' +
  UPSTREAM_CURRENCIES.join(',');

/** Serve without touching the network. */
const FRESH_MS = 60_000;
/** Older than this and we would rather say "unknown" than quote it. */
const MAX_AGE_MS = 15 * 60_000;
/**
 * Upstream is occasionally very slow — a cold call measured ~14s in the wild.
 * Nothing may block on it that long, and nothing needs to: a timed-out refresh
 * just leaves the previous snapshot in place.
 */
const TIMEOUT_MS = 8_000;

let snapshot: RateSnapshot | null = null;
let inFlight: Promise<RateSnapshot | null> | null = null;

function ageOf(s: RateSnapshot): number {
  return Date.now() - s.fetchedAt;
}

/**
 * Are we executing in a browser rather than on the server?
 *
 * Deliberately NOT `typeof window`. jsdom — every component test in this repo —
 * defines `window`, so that check would refuse to fetch during tests and report
 * a passing suite for a module that never ran. Node identifies itself with a
 * version record that bundlers do not synthesise when they shim `process.env`
 * for the browser, which distinguishes the two environments that actually
 * matter here.
 */
function runningInBrowser(): boolean {
  return typeof process === 'undefined' || !process.versions?.node;
}

/**
 * A rate we would be willing to price money with.
 *
 * Guards against upstream handing back nonsense as much as against network
 * failure — a zero, a negative, a NaN or an absurd magnitude means we did not
 * understand the response, and misunderstanding it is exactly how a wrong
 * number gets treated as authoritative.
 */
function isSaneRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 100_000_000;
}

async function fetchUpstream(): Promise<RateSnapshot | null> {
  // This module is server-only by contract, and the contract was being broken.
  // Measured in production 2026-08-28: `api.coingecko.com` was present in a
  // client chunk on disk, and the browser fetched it directly on page load —
  // 534ms in the critical path, one upstream call per visitor instead of one
  // per minute for the platform, and every visitor's IP handed to a third
  // party. It arrives through a transitive import that carries no directive
  // (dashboard page → services/bookings → rates.server → here), which is why
  // the `'use client'` check never saw it.
  //
  // The import graph is being fixed separately and slowly; this is the part
  // that must not wait. Browsers have /api/rates, which is same-origin and
  // shared, so refusing here costs them nothing.
  if (runningInBrowser()) {
    logger.warn(
      'Refusing to fetch rates from a browser — use /api/rates',
      { reason: 'rateSource.server reached the client bundle' },
      'Currency'
    );
    return null;
  }

  try {
    const response = await fetch(SOURCE_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // NOT `cache: 'no-store'`. Next instruments the global fetch and
      // attributes every call to whatever render is on the async stack; a
      // no-store fetch seen during the render of a statically prerendered page
      // reclassifies the route and fails that render:
      //
      //   Error: Page changed from static to dynamic at runtime /discover,
      //   reason: revalidate: 0 fetch https://api.coingecko.com/... /discover
      //
      // The page then paints with no rate at all, which is how "amounts stay
      // in BTC" reached production on a page that had a perfectly good
      // snapshot available.
      //
      // A cacheable fetch is not reclassified, so declaring our freshness
      // window here instead of refusing to cache keeps /discover static. The
      // window is FRESH_MS — the same constant this module already treats as
      // "fresh enough to serve" — so the two caches agree rather than
      // answering "how old is this rate" differently. Within that window a
      // served response can be up to FRESH_MS older than `fetchedAt` implies,
      // which is precisely the staleness the module already accepts.
      next: { revalidate: FRESH_MS / 1000 },
    });

    if (!response.ok) {
      throw new Error(`upstream responded ${response.status}`);
    }

    const body = (await response.json()) as { bitcoin?: Record<string, unknown> };
    const quoted = body.bitcoin ?? {};

    const rates: Record<string, number> = {};
    for (const code of UPSTREAM_CURRENCIES) {
      const value = quoted[code];
      if (isSaneRate(value)) {
        rates[code.toUpperCase()] = value;
      }
    }

    // A response we cannot read any rate out of is a failure, not an empty
    // success — otherwise it would overwrite a good snapshot with nothing.
    if (Object.keys(rates).length === 0) {
      throw new Error('upstream returned no usable rates');
    }

    snapshot = { rates, fetchedAt: Date.now() };
    return snapshot;
  } catch (error) {
    logger.warn(
      'Bitcoin rate lookup failed; amounts stay in BTC until it recovers',
      { error: String(error) },
      'Currency'
    );
    return null;
  }
}

function refresh(): Promise<RateSnapshot | null> {
  // Collapse concurrent callers onto one upstream request.
  if (!inFlight) {
    inFlight = fetchUpstream().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/**
 * Start a refresh that does NOT belong to whatever render asked for it.
 *
 * `fetchUpstream` uses `cache: 'no-store'`, and Next tracks every fetch made
 * during a render. A no-store fetch inside the render of a page that was
 * statically prerendered raises, in production:
 *
 *   Error: Page changed from static to dynamic at runtime /discover,
 *   reason: revalidate: 0 fetch https://api.coingecko.com/... /discover
 *
 * The refresh here is deliberately fire-and-forget — nothing awaits it and the
 * caller has already returned a snapshot or null — but "not awaited" is not the
 * same as "not attributed". Next sees the fetch start inside the render's async
 * context and reclassifies the route, and the page that was meant to paint
 * instantly instead fails its render.
 *
 * CORRECTION (2026-09-05). This function used to claim that the `setTimeout`
 * below "puts the fetch outside that context". It does not, and never did:
 * AsyncLocalStorage propagates through timers by design — that is the whole
 * point of async_hooks — so the callback runs with the render's store still
 * attached. The reclassification error kept firing in production after that
 * change shipped; it was still firing on 2026-09-05.
 *
 * What actually fixes it is in `fetchUpstream`: the request is declared
 * cacheable, so Next has no dynamic fetch to reclassify no matter which async
 * context starts it. The timeout is kept only for what it genuinely does —
 * keep the upstream call off the caller's critical path.
 *
 * Deliberately not `after()` from next/server: this module is called from
 * plain server code as well as from requests, and it must not require a
 * request scope to exist.
 */
function scheduleRefresh(): void {
  setTimeout(() => {
    void refresh();
  }, 0);
}

/**
 * The current rates without ever touching the network.
 *
 * This is what server rendering uses: a page must not wait on a third party to
 * paint. A stale-but-usable snapshot is returned immediately and refreshed in
 * the background, so the next render is current.
 */
export function getCachedRateSnapshot(): RateSnapshot | null {
  if (!snapshot) {
    // A cold process — every deploy — had no way to warm itself from here: it
    // returned null and scheduled nothing, so amounts stayed in BTC until some
    // other caller happened to await getRateSnapshot(). Now that a refresh no
    // longer contaminates the render that triggered it, the first reader can
    // safely start one for the next.
    scheduleRefresh();
    return null;
  }
  const age = ageOf(snapshot);
  if (age > MAX_AGE_MS) {
    scheduleRefresh();
    return null;
  }
  if (age > FRESH_MS) {
    scheduleRefresh();
  }
  return snapshot;
}

/**
 * The current rates, fetching if we have nothing usable.
 *
 * For callers that can afford to wait and must not guess — chiefly pricing an
 * invoice, where the honest alternative to waiting is refusing the payment.
 */
export async function getRateSnapshot(): Promise<RateSnapshot | null> {
  const cached = getCachedRateSnapshot();
  if (cached && ageOf(cached) <= FRESH_MS) {
    return cached;
  }
  return (await refresh()) ?? cached;
}

/** Test seam. Not exported through the barrel. */
export function __setSnapshotForTests(next: RateSnapshot | null): void {
  snapshot = next;
  inFlight = null;
}

// Warm on first import so the first visitor after a restart is not the one who
// pays the cold-start latency. Fire-and-forget by design: nothing waits on it.
void refresh();
