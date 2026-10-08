/**
 * Saving a money rule: what is refused, and what an edit must never lose.
 *
 * The rule is replaced as one ordered list, but a wallet that stays in it keeps
 * its start date — otherwise reordering the lines, or correcting a debt's
 * amount, would reset "AOZ repaid X" to zero.
 */

import { moneyRulesInputSchema, toBps } from '@/domain/money-routes/schema';
import { saveMoneyRules } from '@/domain/money-routes/service';

vi.mock('@/services/currency/rates.server', () => ({ getRenderRates: vi.fn(() => null) }));

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('moneyRulesInputSchema', () => {
  it('accepts taxes first, then a debt, then monthly rent', () => {
    const r = moneyRulesInputSchema.safeParse({
      lines: [
        { walletId: A, kind: 'share', sharePercent: 25 },
        { walletId: B, kind: 'fill', targetAmount: 5000, targetCurrency: 'CHF' },
        { walletId: C, kind: 'fill', targetAmount: 1500, targetCurrency: 'CHF', period: 'monthly' },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('refuses the same wallet twice', () => {
    const r = moneyRulesInputSchema.safeParse({
      lines: [
        { walletId: A, kind: 'share', sharePercent: 10 },
        { walletId: A, kind: 'fill', targetAmount: 10, targetCurrency: 'CHF' },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('refuses shares that add up to more than everything', () => {
    const r = moneyRulesInputSchema.safeParse({
      lines: [
        { walletId: A, kind: 'share', sharePercent: 60 },
        { walletId: B, kind: 'share', sharePercent: 50 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it('refuses a currency OrangeCat does not price in', () => {
    const r = moneyRulesInputSchema.safeParse({
      lines: [{ walletId: A, kind: 'fill', targetAmount: 10, targetCurrency: 'XYZ' }],
    });
    expect(r.success).toBe(false);
  });

  it('converts percent to basis points exactly', () => {
    expect(toBps(25)).toBe(2500);
    expect(toBps(12.5)).toBe(1250);
    expect(toBps(0.07)).toBe(7);
  });
});

/** Client recording deletes and upserts; `existing` = wallets already in the rule. */
function client(existing: string[]) {
  const deleted: string[][] = [];
  const upserts: Array<{ rows: Array<Record<string, unknown>>; onConflict?: string }> = [];
  return {
    deleted,
    upserts,
    from: vi.fn(() => {
      const b: Record<string, unknown> = {};
      b.select = vi.fn(() => b);
      b.eq = vi.fn(() =>
        Object.assign(
          Promise.resolve({ data: existing.map(wallet_id => ({ wallet_id })), error: null }),
          b
        )
      );
      b.delete = vi.fn(() => {
        const d: Record<string, unknown> = {};
        d.eq = vi.fn(() => d);
        d.in = vi.fn((_c: string, ids: string[]) => {
          deleted.push(ids);
          return Promise.resolve({ error: null });
        });
        return d;
      });
      b.upsert = vi.fn((rows: Array<Record<string, unknown>>, opts: { onConflict?: string }) => {
        upserts.push({ rows, onConflict: opts?.onConflict });
        return Promise.resolve({ error: null });
      });
      return b;
    }),
  };
}

describe('saveMoneyRules', () => {
  it('keeps the order as positions and never sends a start date', async () => {
    const db = client([]);
    await saveMoneyRules(db as never, 'user-1', {
      lines: [
        { walletId: A, kind: 'share', sharePercent: 25 },
        { walletId: B, kind: 'fill', targetAmount: 5000, targetCurrency: 'CHF', period: 'once' },
      ],
    });
    const [{ rows, onConflict }] = db.upserts;
    expect(onConflict).toBe('profile_id,wallet_id');
    expect(rows.map(r => [r.wallet_id, r.position])).toEqual([
      [A, 0],
      [B, 1],
    ]);
    expect(rows[0]).toMatchObject({ kind: 'share', share_bps: 2500, target_amount: null });
    expect(rows[1]).toMatchObject({ kind: 'fill', target_amount: 5000, target_currency: 'CHF' });
    // An existing line keeps its start — and with it, what has landed there.
    for (const row of rows) {
      expect(row).not.toHaveProperty('starts_at');
    }
  });

  it('removes only the lines no longer in the rule', async () => {
    const db = client([A, B, C]);
    await saveMoneyRules(db as never, 'user-1', {
      lines: [{ walletId: B, kind: 'share', sharePercent: 30 }],
    });
    expect(db.deleted).toEqual([[A, C]]);
  });
});
