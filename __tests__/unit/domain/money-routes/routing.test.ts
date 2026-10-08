/**
 * The waterfall, as a table of cases: taxes first, then a debt, then rent.
 *
 * One payment always lands whole in one wallet; these pin which one, and that
 * the totals converge on the rule over many payments.
 */

import {
  chooseRoutedWallet,
  lineProgress,
  type RouteLine,
  type RoutedPayment,
} from '@/domain/money-routes/routing';

const T0 = '2026-10-01T00:00:00.000Z';
const NOW = new Date('2026-10-20T12:00:00.000Z');

const tax: RouteLine = {
  walletId: 'tax',
  kind: 'share',
  shareBps: 2500,
  targetAmount: null,
  targetCurrency: null,
  period: 'once',
  startsAt: T0,
};
const aoz: RouteLine = {
  walletId: 'aoz',
  kind: 'fill',
  shareBps: null,
  targetAmount: 1000,
  targetCurrency: 'CHF',
  period: 'once',
  startsAt: T0,
};
const rent: RouteLine = {
  walletId: 'rent',
  kind: 'fill',
  shareBps: null,
  targetAmount: 500,
  targetCurrency: 'CHF',
  period: 'monthly',
  startsAt: T0,
};
const RULE = [tax, aoz, rent];

/** A payment of `chf` francs at 50'000 CHF/BTC, landed in `walletId`. */
function paid(walletId: string, chf: number, paidAt = '2026-10-10T00:00:00.000Z'): RoutedPayment {
  return { walletId, amountBtc: chf / 50_000, ratesAtPaid: { CHF: 50_000 }, paidAt };
}

describe('chooseRoutedWallet — taxes first, then the debt, then rent', () => {
  it('sends the very first payment to taxes', () => {
    expect(chooseRoutedWallet(RULE, [], NOW)).toBe('tax');
  });

  it('moves on once taxes hold their share of everything that came in', () => {
    // 100 in, all of it to tax: tax holds 100 of a 25 target.
    expect(chooseRoutedWallet(RULE, [paid('tax', 100)], NOW)).toBe('aoz');
  });

  it('comes back to taxes when income outgrows their share', () => {
    // 100 to tax, 400 to aoz: 500 in, 25% = 125 > 100 held.
    expect(chooseRoutedWallet(RULE, [paid('tax', 100), paid('aoz', 400)], NOW)).toBe('tax');
  });

  it('fills the debt before rent, and rent once the debt is paid', () => {
    const payments = [paid('tax', 400), paid('aoz', 1000)];
    // 1400 in, tax target 350 < 400 held; debt 1000 of 1000 → rent.
    expect(chooseRoutedWallet(RULE, payments, NOW)).toBe('rent');
  });

  it('returns null when every line is satisfied, so the usual wallet takes it', () => {
    const payments = [paid('tax', 500), paid('aoz', 1000), paid('rent', 500)];
    expect(chooseRoutedWallet(RULE, payments, NOW)).toBeNull();
  });

  it('converges on the rule over many payments', () => {
    const payments: RoutedPayment[] = [];
    for (let i = 0; i < 200; i++) {
      const to = chooseRoutedWallet([tax], payments, NOW) ?? 'spending';
      payments.push(paid(to, 10));
    }
    const toTax = payments.filter(p => p.walletId === 'tax').length;
    // A 25% share of 200 equal payments is 50, within one payment.
    expect(Math.abs(toTax - 50)).toBeLessThanOrEqual(1);
  });
});

describe('lineProgress', () => {
  it('counts a monthly fill from the start of this month only', () => {
    const lastMonth = paid('rent', 500, '2026-09-25T00:00:00.000Z');
    const thisMonth = paid('rent', 200, '2026-10-05T00:00:00.000Z');
    const p = lineProgress(
      { ...rent, startsAt: '2026-09-01T00:00:00.000Z' },
      [lastMonth, thisMonth],
      NOW
    );
    expect(p).toMatchObject({ received: 200, target: 500, unit: 'CHF', behind: true });
  });

  it('ignores payments from before the line began', () => {
    const before = paid('aoz', 900, '2026-09-30T23:59:59.000Z');
    expect(lineProgress(aoz, [before], NOW)).toMatchObject({ received: 0, behind: true });
  });

  it('values a payment with no recorded price at today’s rate', () => {
    const noPrice: RoutedPayment = {
      walletId: 'aoz',
      amountBtc: 0.02,
      ratesAtPaid: null,
      paidAt: '2026-10-10T00:00:00.000Z',
    };
    expect(lineProgress(aoz, [noPrice], NOW, { CHF: 60_000 })).toMatchObject({
      received: 1200,
      behind: false,
      unvalued: 0,
    });
  });

  it('never reads a fill as reached on money nobody can value', () => {
    const noPrice: RoutedPayment = {
      walletId: 'aoz',
      amountBtc: 1,
      ratesAtPaid: null,
      paidAt: '2026-10-10T00:00:00.000Z',
    };
    expect(lineProgress(aoz, [noPrice], NOW, {})).toMatchObject({
      received: 0,
      behind: true,
      unvalued: 1,
    });
  });

  it('fills an amount named in BTC without any price', () => {
    const btcFill: RouteLine = { ...aoz, targetAmount: 0.05, targetCurrency: 'BTC' };
    const p = lineProgress(
      btcFill,
      [{ walletId: 'aoz', amountBtc: 0.02, ratesAtPaid: null, paidAt: '2026-10-10T00:00:00.000Z' }],
      NOW,
      {}
    );
    expect(p).toMatchObject({
      unit: 'BTC',
      received: 0.02,
      target: 0.05,
      behind: true,
      unvalued: 0,
    });
  });

  it('compares a share in BTC, needing no price at all', () => {
    const p = lineProgress(
      tax,
      [{ walletId: 'tax', amountBtc: 0.1, ratesAtPaid: null, paidAt: '2026-10-10T00:00:00.000Z' }],
      NOW
    );
    expect(p).toMatchObject({ unit: 'BTC', received: 0.1, unvalued: 0 });
  });
});
