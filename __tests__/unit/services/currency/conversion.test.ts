/**
 * Unit tests for the synchronous currency conversion module.
 *
 * Covers BTC<->SATS arithmetic, BTC<->fiat conversion against an installed rate
 * snapshot, the round-trip identity, and — critically — the safe-failure
 * behavior when a currency has no known rate (must return 0, never fabricate).
 *
 * The rate cache starts EMPTY on purpose and every test that needs a rate
 * installs one. See the "no fabricated rates" block at the bottom: seeded
 * "sane defaults" once made a wrong-but-plausible rate the normal case, which
 * mis-priced real invoices for as long as nobody looked.
 */

import {
  satsToBitcoin,
  bitcoinToSats,
  convertBtcTo,
  convertToBtc,
  convert,
} from '@/services/currency/conversion';
import { applyRateSnapshot, cache, currencyConverter } from '@/services/currency/rates';

/** Arbitrary, obviously-test values — never real-looking constants to copy. */
const TEST_RATES = { CHF: 50_000, USD: 60_000, EUR: 55_000, GBP: 45_000 };

beforeEach(() => {
  currencyConverter.clearCache();
  applyRateSnapshot({ rates: TEST_RATES, fetchedAt: Date.now() });
});

// Silence the warn that the missing-rate path emits.
vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const SATS_PER_BTC = 100_000_000;

describe('BTC <-> SATS', () => {
  it('satsToBitcoin divides by 100M', () => {
    expect(satsToBitcoin(SATS_PER_BTC)).toBe(1);
    expect(satsToBitcoin(50_000_000)).toBe(0.5);
    expect(satsToBitcoin(0)).toBe(0);
  });

  it('bitcoinToSats multiplies by 100M and rounds', () => {
    expect(bitcoinToSats(1)).toBe(SATS_PER_BTC);
    expect(bitcoinToSats(0.5)).toBe(50_000_000);
    // Floating point: 0.1 BTC -> exactly 10,000,000 sats (rounded, not 9999999.9)
    expect(bitcoinToSats(0.1)).toBe(10_000_000);
  });

  it('round-trips sats -> btc -> sats', () => {
    expect(bitcoinToSats(satsToBitcoin(123_456_789))).toBe(123_456_789);
  });
});

describe('convertBtcTo', () => {
  it('returns the amount unchanged for BTC', () => {
    expect(convertBtcTo(0.5, 'BTC')).toBe(0.5);
  });

  it('converts BTC to SATS (rounded integer)', () => {
    expect(convertBtcTo(0.001, 'SATS')).toBe(100_000);
  });

  it('converts BTC to fiat using the cached rate', () => {
    const rate = cache.rates['BTC_CHF'];
    expect(convertBtcTo(2, 'CHF')).toBe(2 * rate);
  });

  it('returns 0 for a currency with no rate (never fabricates)', () => {
    expect(convertBtcTo(1, 'JPY')).toBe(0);
  });
});

describe('convertToBtc', () => {
  it('returns the amount unchanged for BTC', () => {
    expect(convertToBtc(0.5, 'BTC')).toBe(0.5);
  });

  it('converts SATS to BTC', () => {
    expect(convertToBtc(100_000, 'SATS')).toBe(0.001);
  });

  it('converts fiat to BTC using the cached rate', () => {
    const rate = cache.rates['BTC_USD'];
    expect(convertToBtc(rate, 'USD')).toBe(1);
  });

  it('returns 0 for a currency with no rate — must NOT treat fiat as BTC', () => {
    // The bug this guards against: `amount / 1` rendering "100 JPY" as "100 BTC".
    expect(convertToBtc(100, 'JPY')).toBe(0);
  });
});

describe('convert (fiat <-> fiat via BTC)', () => {
  it('returns the amount unchanged when currencies match', () => {
    expect(convert(42, 'CHF', 'CHF')).toBe(42);
  });

  it('round-trips CHF -> BTC -> CHF without drift', () => {
    const out = convert(convert(100, 'CHF', 'BTC'), 'BTC', 'CHF');
    expect(out).toBeCloseTo(100, 6);
  });

  it('converts between two fiats consistently with the rates', () => {
    const usd = 100;
    const expectedChf = (usd / cache.rates['BTC_USD']) * cache.rates['BTC_CHF'];
    expect(convert(usd, 'USD', 'CHF')).toBeCloseTo(expectedChf, 8);
  });

  it('yields 0 when either leg has no rate', () => {
    expect(convert(100, 'JPY', 'CHF')).toBe(0);
    expect(convert(100, 'CHF', 'JPY')).toBe(0);
  });
});

describe('no fabricated rates', () => {
  it('starts with an empty cache — an unknown rate must stay unknown', () => {
    currencyConverter.clearCache();
    expect(Object.keys(cache.rates)).toHaveLength(0);
    // Every supported fiat, not just an exotic one: the old seeded cache meant
    // the "cannot convert" guard was unreachable for exactly the currencies
    // people actually use.
    for (const code of ['CHF', 'USD', 'EUR', 'GBP']) {
      expect(convertBtcTo(1, code)).toBe(0);
      expect(convertToBtc(100, code)).toBe(0);
    }
  });

  it('forgets rates once they are too old to stand behind', () => {
    currencyConverter.clearCache();
    applyRateSnapshot({ rates: TEST_RATES, fetchedAt: Date.now() - 60 * 60_000 });
    expect(convertBtcTo(1, 'CHF')).toBe(0);
  });
});
