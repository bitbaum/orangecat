/**
 * "Came in" on Your money — and the tax estimate built on it.
 *
 * Two things were wrong and nothing tested either:
 *  - A purchase writes a payment intent AND an order, and settlement marks
 *    both paid. Income summed both, so every sale counted twice.
 *  - Income was converted to fiat at TODAY's price. Income is valued on the
 *    day it arrives, and Bitcoin moves enough in a year to make that the whole
 *    estimate.
 *
 * These pin: intents are the income (orders are never read), each payment is
 * valued at the price recorded when it arrived, and a payment with no recorded
 * price is valued at today's rate only while SAYING so.
 */

import { getPersonalFinances, valueIncome } from '@/domain/finances/service';
import { convertBtcToOrNull } from '@/services/currency/rates.server';

import type { Mock } from 'vitest';

vi.mock('@/services/currency/rates.server', () => ({ convertBtcToOrNull: vi.fn() }));
vi.mock('@/domain/civic-split/service', () => ({ getCivicSplit: vi.fn().mockResolvedValue(null) }));

describe('valueIncome', () => {
  it('values each payment at the price recorded when it arrived', () => {
    const v = valueIncome(
      [
        { amount_btc: 0.01, rates_at_paid: { CHF: 50_000 } },
        { amount_btc: 0.02, rates_at_paid: { CHF: 60_000 } },
      ],
      'CHF'
    );
    // 500 + 1200 — NOT 0.03 × whatever today's price is.
    expect(v.atReceipt).toBeCloseTo(1700, 6);
    expect(v.totalBtc).toBeCloseTo(0.03, 10);
    expect(v.unvaluedCount).toBe(0);
  });

  it('counts payments with no price for this currency instead of hiding them', () => {
    const v = valueIncome(
      [
        { amount_btc: 0.01, rates_at_paid: { EUR: 55_000 } },
        { amount_btc: 0.02, rates_at_paid: null },
        { amount_btc: 0.03, rates_at_paid: { CHF: 50_000 } },
      ],
      'chf'
    );
    expect(v.atReceipt).toBeCloseTo(1500, 6);
    expect(v.unvaluedBtc).toBeCloseTo(0.03, 10);
    expect(v.unvaluedCount).toBe(2);
  });

  it('needs no price at all in BTC or sats', () => {
    const v = valueIncome([{ amount_btc: 0.5, rates_at_paid: null }], 'BTC');
    expect(v).toEqual({ totalBtc: 0.5, atReceipt: 0, unvaluedBtc: 0.5, unvaluedCount: 0 });
  });
});

/** Supabase client recording which tables are read; payment_intents returns `rows`. */
function client(rows: unknown[]) {
  const tables: string[] = [];
  return {
    tables,
    from: vi.fn((table: string) => {
      tables.push(table);
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gte', 'in', 'is', 'gt', 'order']) {
        b[m] = vi.fn(() => b);
      }
      b.limit = vi.fn(() =>
        Promise.resolve({ data: table === 'payment_intents' ? rows : [], error: null })
      );
      return b;
    }),
  };
}

describe('getPersonalFinances income', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads payment intents only — a sale is counted once, never again as an order', async () => {
    const db = client([{ amount_btc: 0.01, rates_at_paid: { CHF: 50_000 } }]);
    const f = await getPersonalFinances(db as never, 'user-1', ['actor-1'], 'CHF');

    expect(db.tables).toContain('payment_intents');
    expect(db.tables).not.toContain('orders');
    expect(f.income).toMatchObject({ payments: 1, total: 500, valuedAtToday: 0 });
    expect(convertBtcToOrNull).not.toHaveBeenCalled();
  });

  it('values an unpriced payment at today’s rate and says how many it did', async () => {
    (convertBtcToOrNull as Mock).mockResolvedValue(700);
    const db = client([
      { amount_btc: 0.01, rates_at_paid: { CHF: 50_000 } },
      { amount_btc: 0.01, rates_at_paid: null },
    ]);
    const f = await getPersonalFinances(db as never, 'user-1', ['actor-1'], 'CHF');

    expect(convertBtcToOrNull).toHaveBeenCalledWith(0.01, 'CHF');
    expect(f.income).toMatchObject({ payments: 2, total: 1200, valuedAtToday: 1 });
  });

  it('gives no total rather than a partial one when today’s rate is missing too', async () => {
    (convertBtcToOrNull as Mock).mockResolvedValue(null);
    const db = client([
      { amount_btc: 0.01, rates_at_paid: { CHF: 50_000 } },
      { amount_btc: 0.01, rates_at_paid: null },
    ]);
    const f = await getPersonalFinances(db as never, 'user-1', ['actor-1'], 'CHF');

    expect(f.income.total).toBeNull();
  });
});
