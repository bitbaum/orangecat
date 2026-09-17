/**
 * The rate cache every conversion reads from.
 *
 * It starts EMPTY, and that is the whole point. It used to be seeded with
 * BTC_CHF: 86000 / BTC_USD: 97000 / BTC_EUR: 91000 "defaults", which meant the
 * `if (!rate) cannot convert` guard downstream was unreachable for the very
 * currencies people actually use — there was always a number, just not a true
 * one. When those seeds were last plausible is anyone's guess; at the time this
 * was rewritten the real CHF rate was 52,199, so a price of CHF 100 converted to
 * an invoice worth about CHF 61 and nothing anywhere said so.
 *
 * Empty means "we don't know", and "we don't know" is a state the UI and the
 * payment path both know how to handle honestly. See rateSource.server.ts for where
 * real rates come from.
 *
 * This module is isomorphic. It never imports rateSource (that is server-only,
 * and pulling it into a client bundle would ship an outbound third-party fetch
 * to every browser). Instead:
 *   - the browser fills the cache from our own /api/rates
 *   - the server fills it via rates.server.ts
 */

import { API_ROUTES } from '@/config/api-routes';
import type { CurrencyCode } from '@/config/currencies';
import { logger } from '@/utils/logger';
import type { ExchangeRates, RateCache } from './types';
import { APP_LOCALE } from '@/utils/locale';

// ==================== RATE CACHE ====================

/**
 * Known BTC prices, keyed `BTC_<CODE>`. Absent key = unknown rate, never zero
 * and never a placeholder.
 */
export const cache: RateCache = {
  rates: {},
  lastUpdated: null,
  expiresAt: null,
};

const SATS_PER_BTC = 100_000_000;

/** How long a snapshot stays usable before we treat it as unknown again. */
const MAX_AGE_MS = 15 * 60_000;

export interface RateSnapshotLike {
  rates: Readonly<Record<string, number>>;
  fetchedAt: number;
}

/**
 * Adopt a rate snapshot from whichever side fetched it.
 *
 * Exported so server rendering can hand the browser the rates it already had,
 * letting the first paint be denominated in the payer's own currency instead of
 * flashing BTC until a client fetch lands.
 */
export function applyRateSnapshot(snapshot: RateSnapshotLike | null): void {
  if (!snapshot || Date.now() - snapshot.fetchedAt > MAX_AGE_MS) {
    return;
  }
  for (const [code, value] of Object.entries(snapshot.rates)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      cache.rates[`BTC_${code.toUpperCase()}`] = value;
    }
  }
  cache.lastUpdated = new Date(snapshot.fetchedAt);
  cache.expiresAt = new Date(snapshot.fetchedAt + MAX_AGE_MS);
}

/** The BTC price in `currency`, or null when we genuinely do not know it. */
export function getRate(currency: string): number | null {
  const code = currency.toUpperCase();
  if (code === 'BTC') {
    return 1;
  }
  if (cache.expiresAt && cache.expiresAt.getTime() < Date.now()) {
    return null;
  }
  return cache.rates[`BTC_${code}`] ?? null;
}

/** Have we got a usable rate for anything? */
export function hasUsableRates(): boolean {
  return (
    Object.keys(cache.rates).length > 0 &&
    !!cache.expiresAt &&
    cache.expiresAt.getTime() >= Date.now()
  );
}

function toExchangeRates(): ExchangeRates | null {
  const chf = getRate('CHF');
  const usd = getRate('USD');
  const eur = getRate('EUR');
  const gbp = getRate('GBP');
  if (!chf && !usd && !eur && !gbp) {
    return null;
  }
  return {
    btcToChf: chf ?? 0,
    btcToUsd: usd ?? 0,
    btcToEur: eur ?? 0,
    btcToGbp: gbp ?? 0,
    lastUpdated: cache.lastUpdated?.getTime() ?? 0,
  };
}

// ==================== CONVERTER ====================

const isBrowser = typeof window !== 'undefined';

/**
 * How long to stop asking after a failed rate load.
 *
 * `fetchPromise` collapses CONCURRENT callers, but nothing stopped SEQUENTIAL
 * ones: a failure leaves the cache empty, so the next component to ask starts
 * a fresh request, and the next, and the next. Measured in a browser whose DNS
 * was failing: 98 requests to /api/rates from a single page. The one moment
 * the endpoint is unreachable is the worst moment to hammer it.
 *
 * Short enough that a blip costs at most this much staleness, long enough that
 * a page full of prices makes one attempt rather than one per price.
 */
const FAILURE_COOLDOWN_MS = 30_000;

class CurrencyConverterService {
  private fetchPromise: Promise<ExchangeRates | null> | null = null;
  private lastFailureAt = 0;

  /**
   * Load rates from our own origin.
   *
   * Browser-only: on the server the cache is filled by rates.server.ts, which
   * talks to the upstream directly. A server calling its own HTTP endpoint would
   * be a needless round trip and, behind a single-process reverse proxy, a good
   * way to deadlock under load.
   */
  private async fetchRates(): Promise<ExchangeRates | null> {
    if (!isBrowser) {
      return toExchangeRates();
    }
    if (this.fetchPromise) {
      return this.fetchPromise;
    }
    // Still inside the cooldown from a recent failure — answer "unknown"
    // without a request. Callers already handle null by leaving amounts in BTC.
    if (this.lastFailureAt && Date.now() - this.lastFailureAt < FAILURE_COOLDOWN_MS) {
      return null;
    }

    this.fetchPromise = (async () => {
      try {
        const response = await fetch(API_ROUTES.RATES, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error(`rates endpoint responded ${response.status}`);
        }
        const body = (await response.json()) as { data?: RateSnapshotLike };
        applyRateSnapshot(body.data ?? null);
        this.lastFailureAt = 0;
        return toExchangeRates();
      } catch (error) {
        // Open the cooldown so a page full of prices does not turn one
        // unreachable endpoint into one request per price.
        this.lastFailureAt = Date.now();
        logger.warn(
          'Could not load Bitcoin rates; amounts stay in BTC',
          { error: String(error) },
          'Currency'
        );
        return null;
      } finally {
        this.fetchPromise = null;
      }
    })();

    return this.fetchPromise;
  }

  /** Current rates, loading them if the cache has nothing usable. */
  async getRates(): Promise<ExchangeRates | null> {
    if (hasUsableRates()) {
      return toExchangeRates();
    }
    return this.fetchRates();
  }

  /** Cached rates only — null when unknown. Never blocks, never guesses. */
  getCachedRates(): ExchangeRates | null {
    return hasUsableRates() ? toExchangeRates() : null;
  }

  /** Fiat → BTC. Returns 0 when the rate is unknown; callers must not treat that as free. */
  async toBTC(amount: number, fromCurrency: CurrencyCode): Promise<number> {
    if (amount === 0) {
      return 0;
    }
    const code = String(fromCurrency).toUpperCase();
    if (code === 'BTC') {
      return amount;
    }
    if (code === 'SATS') {
      return amount / SATS_PER_BTC;
    }
    await this.getRates();
    const rate = getRate(code);
    return rate ? amount / rate : 0;
  }

  /** BTC → fiat. Returns 0 when the rate is unknown. */
  async fromBTC(amountBTC: number, toCurrency: CurrencyCode): Promise<number> {
    if (amountBTC === 0) {
      return 0;
    }
    const code = String(toCurrency).toUpperCase();
    if (code === 'BTC') {
      return amountBTC;
    }
    if (code === 'SATS') {
      return Math.round(amountBTC * SATS_PER_BTC);
    }
    await this.getRates();
    const rate = getRate(code);
    return rate ? amountBTC * rate : 0;
  }

  async convert(
    amount: number,
    fromCurrency: CurrencyCode,
    toCurrency: CurrencyCode
  ): Promise<number> {
    if (amount === 0 || fromCurrency === toCurrency) {
      return amount;
    }
    const btcAmount = await this.toBTC(amount, fromCurrency);
    return this.fromBTC(btcAmount, toCurrency);
  }

  formatBTC(amountBTC: number, showDecimals = true): string {
    if (amountBTC === 0) {
      return '0 BTC';
    }
    if (showDecimals) {
      return `${amountBTC.toLocaleString(APP_LOCALE, { maximumFractionDigits: 8 })} BTC`;
    }
    return `${amountBTC.toFixed(2)} BTC`;
  }

  clearCache(): void {
    cache.rates = {};
    cache.lastUpdated = null;
    cache.expiresAt = null;
    this.fetchPromise = null;
  }
}

export const currencyConverter = new CurrencyConverterService();

// Convenience async functions
export async function convertToBTC(amount: number, fromCurrency: CurrencyCode): Promise<number> {
  return currencyConverter.toBTC(amount, fromCurrency);
}

export async function convertFromBTC(amountBTC: number, toCurrency: CurrencyCode): Promise<number> {
  return currencyConverter.fromBTC(amountBTC, toCurrency);
}
