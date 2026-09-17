/**
 * Cat Credit usage metering — money path.
 *
 * The unit is BTC everywhere: this suite pins the 2026-07-02 fix where
 * calculateCostBtc returned satoshis despite its name (a 1e8 drift that would
 * have drained balances). It also pins the metering rules: only paid registry
 * models bill, the debit is cost × markup rounded up to 1e-8, and a failed
 * ledger append never throws at the user.
 */

import {
  meterCreditUsage,
  checkFrontierAccess,
  isPlatformMeteredModel,
  CREDIT_USAGE_MARKUP,
  ESTIMATE_SAFETY_MULTIPLIER,
  MIN_FRONTIER_BALANCE_BTC,
} from '@/services/cat/credit-metering';
import { calculateCostBtc, getFreeModels, getAvailableModels } from '@/config/ai-models';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Registry estimates are priced in USD, so they need a BTC/USD rate. Pin it for
// determinism — and let a test return null to prove we bill nothing without one.
const convertBtcToOrNull = vi.fn().mockResolvedValue(100000); // 1 BTC = 100k USD
vi.mock('@/services/currency/rates.server', () => ({
  convertBtcToOrNull: (...a: unknown[]) => convertBtcToOrNull(...a),
}));

const appendCreditEntry = vi.fn();
const getCreditBalance = vi.fn();
vi.mock('@/services/cat/credits', () => ({
  appendCreditEntry: (...a: unknown[]) => appendCreditEntry(...a),
  getCreditBalance: (...a: unknown[]) => getCreditBalance(...a),
}));

const admin = {} as never;
const PAID_MODEL = getAvailableModels().find(m => m.tier !== 'free')?.id as string;
const FREE_MODEL = getFreeModels()[0]?.id as string;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('calculateCostBtc returns BTC, not satoshis', () => {
  it('a ~$0.01 completion costs ~1e-7 BTC (would be ~10 BTC under the sats bug)', () => {
    // Any paid model: cost scales linearly, so assert the magnitude bound.
    const cost = calculateCostBtc(PAID_MODEL, 1000, 1000, 100000);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.001); // sats-bug values were >= 1 whole unit
  });

  it('rounds up to ledger precision instead of billing 0', () => {
    const cost = calculateCostBtc(PAID_MODEL, 1, 1, 100000);
    expect(cost).toBeGreaterThanOrEqual(0.00000001);
  });

  it('provider-resolved paid model ids use the registered model price', () => {
    expect(calculateCostBtc(`${PAID_MODEL}-20260708`, 1000, 1000)).toBe(
      calculateCostBtc(PAID_MODEL, 1000, 1000)
    );
  });

  it('unknown models cost 0 until a registry model can be resolved', () => {
    expect(calculateCostBtc('no-such-model', 1000, 1000)).toBe(0);
  });
});

describe('isPlatformMeteredModel', () => {
  it('true for paid registry models only', () => {
    expect(isPlatformMeteredModel(PAID_MODEL)).toBe(true);
    expect(isPlatformMeteredModel(`${PAID_MODEL}-20260708`)).toBe(true);
    expect(isPlatformMeteredModel(FREE_MODEL)).toBe(false);
    expect(isPlatformMeteredModel(`${FREE_MODEL.replace(/:free$/, '')}-20260708:free`)).toBe(false);
    expect(isPlatformMeteredModel('not-in-registry')).toBe(false);
    expect(isPlatformMeteredModel(undefined)).toBe(false);
  });
});

describe('checkFrontierAccess', () => {
  it('allows at or above the minimum balance', async () => {
    getCreditBalance.mockResolvedValue(MIN_FRONTIER_BALANCE_BTC);
    await expect(checkFrontierAccess(admin, 'u1')).resolves.toEqual({
      allowed: true,
      balanceBtc: MIN_FRONTIER_BALANCE_BTC,
    });
  });

  it('denies below it', async () => {
    getCreditBalance.mockResolvedValue(0);
    await expect(checkFrontierAccess(admin, 'u1')).resolves.toMatchObject({ allowed: false });
  });
});

describe('meterCreditUsage', () => {
  it('debits cost × markup as a negative usage entry with the request ref', async () => {
    appendCreditEntry.mockResolvedValue(0.001);
    const charged = await meterCreditUsage(admin, 'u1', {
      model: PAID_MODEL,
      inputTokens: 100000,
      outputTokens: 100000,
      ref: 'cat_chat_abc',
    });

    expect(charged).toBeGreaterThan(0);
    expect(appendCreditEntry).toHaveBeenCalledTimes(1);
    const [, userId, entry] = appendCreditEntry.mock.calls[0] as [unknown, string, any];
    expect(userId).toBe('u1');
    expect(entry.kind).toBe('usage');
    expect(entry.ref).toBe('cat_chat_abc');
    expect(entry.amountBtc).toBeCloseTo(-charged, 10);
    // Post-serve settlement must always record the charge — even past the
    // gated balance — so a low-balance user can't get unlimited free calls.
    expect(entry.allowOverdraw).toBe(true);

    // No provider-reported cost → registry estimate, which carries the extra
    // safety pad on top of the platform markup.
    const raw = calculateCostBtc(PAID_MODEL, 100000, 100000, 100000);
    const expected = raw * CREDIT_USAGE_MARKUP * ESTIMATE_SAFETY_MULTIPLIER;
    expect(charged).toBeGreaterThanOrEqual(expected - 1e-8);
    expect(charged).toBeLessThan(expected + 1e-7);
    expect(entry.metadata.pricingSource).toBe('registry_estimate');
    expect(entry.metadata.markup).toBeCloseTo(CREDIT_USAGE_MARKUP * ESTIMATE_SAFETY_MULTIPLIER, 10);
  });

  it('never bills free or unknown models', async () => {
    await meterCreditUsage(admin, 'u1', {
      model: FREE_MODEL,
      inputTokens: 5000,
      outputTokens: 5000,
      ref: 'r1',
    });
    await meterCreditUsage(admin, 'u1', {
      model: 'no-such-model',
      inputTokens: 5000,
      outputTokens: 5000,
      ref: 'r2',
    });
    expect(appendCreditEntry).not.toHaveBeenCalled();
  });

  it('bills provider-resolved paid model ids instead of treating them as unknown', async () => {
    appendCreditEntry.mockResolvedValue(0.001);
    const charged = await meterCreditUsage(admin, 'u1', {
      model: `${PAID_MODEL}-20260708`,
      inputTokens: 100000,
      outputTokens: 100000,
      ref: 'resolved-model',
    });

    expect(charged).toBeGreaterThan(0);
    expect(appendCreditEntry).toHaveBeenCalledTimes(1);
  });

  it('prefers provider-reported request cost over the registry estimate when available', async () => {
    appendCreditEntry.mockResolvedValue(0.001);
    const providerReportedRawCostBtc = 0.00000234;
    const charged = await meterCreditUsage(admin, 'u1', {
      model: PAID_MODEL,
      inputTokens: 100000,
      outputTokens: 100000,
      rawCostBtc: providerReportedRawCostBtc,
      ref: 'provider-cost',
    });

    const expectedCharge = Math.ceil(providerReportedRawCostBtc * CREDIT_USAGE_MARKUP * 1e8) / 1e8;
    expect(charged).toBe(expectedCharge);
    const [, , entry] = appendCreditEntry.mock.calls[0] as [unknown, string, any];
    expect(entry.metadata.rawCostBtc).toBe(providerReportedRawCostBtc);
    expect(entry.metadata.pricingSource).toBe('provider_reported');
  });

  it('bills nothing when a registry estimate has no BTC/USD rate to price it', async () => {
    // This used to fall back to a hardcoded 100,000 USD/BTC and debit a real
    // ledger against it. Taking the wrong amount of someone's money is worse
    // than taking none and reconciling from the logs.
    convertBtcToOrNull.mockResolvedValueOnce(null);
    appendCreditEntry.mockResolvedValue(0.001);

    const charged = await meterCreditUsage(admin, 'u1', {
      model: PAID_MODEL,
      inputTokens: 100000,
      outputTokens: 100000,
      ref: 'no-rate',
    });

    expect(charged).toBe(0);
    expect(appendCreditEntry).not.toHaveBeenCalled();
  });

  it('needs no rate at all for a provider-reported cost — it is already in BTC', async () => {
    appendCreditEntry.mockResolvedValue(0.001);

    const charged = await meterCreditUsage(admin, 'u1', {
      model: PAID_MODEL,
      inputTokens: 100,
      outputTokens: 100,
      rawCostBtc: 0.00000234,
      ref: 'no-rate-provider-cost',
    });

    expect(charged).toBeGreaterThan(0);
    expect(convertBtcToOrNull).not.toHaveBeenCalled();
  });

  it('returns 0 (never throws) but retries before giving up when the ledger keeps failing', async () => {
    appendCreditEntry.mockResolvedValue(null);
    await expect(
      meterCreditUsage(admin, 'u1', {
        model: PAID_MODEL,
        inputTokens: 100000,
        outputTokens: 100000,
        ref: 'r3',
      })
    ).resolves.toBe(0);
    // Retried the idempotent debit rather than handing out a free frontier call.
    expect(appendCreditEntry.mock.calls.length).toBeGreaterThan(1);
  });

  it('recovers from a transient ledger failure and still bills', async () => {
    appendCreditEntry.mockResolvedValueOnce(null).mockResolvedValueOnce(0.0005);
    const charged = await meterCreditUsage(admin, 'u1', {
      model: PAID_MODEL,
      inputTokens: 100000,
      outputTokens: 100000,
      ref: 'retry-ref',
    });
    expect(charged).toBeGreaterThan(0);
    expect(appendCreditEntry).toHaveBeenCalledTimes(2);
  });
});
