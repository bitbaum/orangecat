/**
 * A wallet's balance is BTC; its goal is denominated in `goal_currency`. Both
 * surfaces that drew the progress bar divided one straight into the other, so
 * every fiat goal — which, measured against production, is every goal that
 * exists — had a meaningless percentage under it.
 *
 * The cases below are the ones that decide whether a number is honest:
 * conversion applied, conversion unnecessary, and conversion unavailable. The
 * last is the one worth arguing about — `useCurrencyConversion` returns 0 for a
 * rate it does not have, and 0 read as a percentage says "you have saved
 * nothing" about a wallet that may be fully funded.
 *
 * Gated by scripts/check-currency-units.mjs; this is the instance.
 */

import { computeWalletGoalProgress, measuredBalanceBtc } from '@/lib/wallet-goal';

/** Stand-in for the rate cache: CHF only, at a round 100 000 CHF/BTC. */
const convert = (btc: number, currency: string) => (currency === 'CHF' ? btc * 100_000 : 0);

describe('computeWalletGoalProgress', () => {
  it('converts the BTC balance into the goal currency before comparing', () => {
    const goal = computeWalletGoalProgress(
      { balanceBtc: 0.025, goalAmount: 2500, goalCurrency: 'CHF' },
      convert
    );
    expect(goal?.balanceInGoalCurrency).toBe(2500);
    expect(goal?.percent).toBe(100);
    expect(goal?.currency).toBe('CHF');
  });

  it('is the fix: the old expression would have called that same wallet 0.001% funded', () => {
    const balanceBtc = 0.025;
    const goalAmount = 2500;
    expect((balanceBtc / goalAmount) * 100).toBeCloseTo(0.001);

    const goal = computeWalletGoalProgress(
      { balanceBtc, goalAmount, goalCurrency: 'CHF' },
      convert
    );
    expect(goal?.percent).toBe(100);
  });

  it('does not convert a BTC-denominated goal', () => {
    const goal = computeWalletGoalProgress(
      { balanceBtc: 0.5, goalAmount: 1, goalCurrency: 'BTC' },
      () => {
        throw new Error('must not consult a rate for a BTC goal');
      }
    );
    expect(goal?.percent).toBe(50);
  });

  it('needs no rate for an empty wallet — zero is zero in every currency', () => {
    const goal = computeWalletGoalProgress(
      { balanceBtc: 0, goalAmount: 2500, goalCurrency: 'CHF' },
      () => {
        throw new Error('must not consult a rate for a zero balance');
      }
    );
    expect(goal?.balanceInGoalCurrency).toBe(0);
    expect(goal?.percent).toBe(0);
  });

  it('reports no percentage when the rate is unavailable, rather than claiming 0%', () => {
    const goal = computeWalletGoalProgress(
      { balanceBtc: 0.025, goalAmount: 2500, goalCurrency: 'JPY' },
      convert // returns 0 for anything but CHF — the cache's "no rate" signal
    );
    expect(goal?.balanceInGoalCurrency).toBeNull();
    expect(goal?.percent).toBeNull();
    expect(goal?.goalAmount).toBe(2500);
  });

  it('treats a missing currency as BTC, the stored unit', () => {
    const goal = computeWalletGoalProgress(
      { balanceBtc: 0.5, goalAmount: 2, goalCurrency: null },
      convert
    );
    expect(goal?.currency).toBe('BTC');
    expect(goal?.percent).toBe(25);
  });

  it('is case-insensitive about the currency code', () => {
    const goal = computeWalletGoalProgress(
      { balanceBtc: 0.01, goalAmount: 1000, goalCurrency: 'chf' },
      convert
    );
    expect(goal?.percent).toBe(100);
  });

  it('returns null when there is no goal to show', () => {
    expect(
      computeWalletGoalProgress({ balanceBtc: 1, goalAmount: null, goalCurrency: 'CHF' }, convert)
    ).toBeNull();
    expect(
      computeWalletGoalProgress({ balanceBtc: 1, goalAmount: 0, goalCurrency: 'CHF' }, convert)
    ).toBeNull();
  });

  it('treats an unreadable balance as unknown, not as zero', () => {
    // `balance_btc` is not among PUBLIC_WALLET_FIELDS, so a visitor's payload
    // does not carry it. Coercing that to 0 would report "0% funded" about a
    // wallet nobody looked at.
    for (const balanceBtc of [Number.NaN, undefined, null]) {
      const goal = computeWalletGoalProgress(
        { balanceBtc, goalAmount: 2500, goalCurrency: 'CHF' },
        convert
      );
      expect(goal?.balanceInGoalCurrency).toBeNull();
      expect(goal?.percent).toBeNull();
      expect(goal?.goalAmount).toBe(2500);
    }
  });

  it('still reports 0% for a wallet genuinely holding nothing', () => {
    const goal = computeWalletGoalProgress(
      { balanceBtc: 0, goalAmount: 2500, goalCurrency: 'CHF' },
      convert
    );
    expect(goal?.percent).toBe(0);
  });
});

describe('measuredBalanceBtc — a balance nobody read is unknown, not zero', () => {
  // The column defaults to 0, so the owner's own wallets showed "Current
  // Balance CHF 0.00" and "0.0% funded" beside "Not checked yet" before any
  // chain lookup had happened (production, 2026-11-12).
  it('is null for the default 0 when no lookup has happened', () => {
    expect(measuredBalanceBtc({ balance_btc: 0, balance_updated_at: null })).toBeNull();
  });

  it('is the balance once a lookup is recorded, zero included', () => {
    expect(measuredBalanceBtc({ balance_btc: 0, balance_updated_at: '2026-11-12T07:00:00Z' })).toBe(
      0
    );
    expect(
      measuredBalanceBtc({ balance_btc: 0.0123, balance_updated_at: '2026-11-12T07:00:00Z' })
    ).toBe(0.0123);
  });

  it("is null for a visitor's payload, which carries neither field", () => {
    expect(measuredBalanceBtc({})).toBeNull();
  });

  it('gives no percentage for a goal on an unread wallet', () => {
    const goal = computeWalletGoalProgress(
      {
        balanceBtc: measuredBalanceBtc({ balance_btc: 0, balance_updated_at: null }),
        goalAmount: 2500,
        goalCurrency: 'CHF',
      },
      () => 0
    );
    expect(goal?.percent).toBeNull();
    expect(goal?.balanceInGoalCurrency).toBeNull();
  });
});
