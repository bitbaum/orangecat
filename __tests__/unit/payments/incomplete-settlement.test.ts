/**
 * Incomplete-settlement detection — bitbaum/orangecat#563 finding 4.
 *
 * handlePaymentConfirmed flips the intent to `paid` FIRST, because that
 * conditional update is the lock that makes settlement run exactly once. Only
 * then does it write the order, decrement inventory, notify the seller and fan
 * out webhooks.
 *
 * A crash in that gap used to lose all of it in total silence — the row is
 * paid, so every later observer's claimPaidTransition returns false and skips
 * it as already settled, refresh short-circuits on terminal statuses, and the
 * reconcile sweep only looks at CREATED / INVOICE_READY / PENDING_CONFIRMATION.
 * The buyer's money is gone and their order sits in pending_payment forever.
 *
 * These tests pin the query that finds those rows, and — just as important —
 * that it does NOT try to replay them.
 */

import { findIncompleteSettlements } from '@/services/payments/reconcile';
import { STATUS } from '@/config/database-constants';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { logger } from '@/utils/logger';

import type { Mock } from 'vitest';

/** Records the filters applied, so the predicate itself can be asserted. */
function makeAdmin(result: { data: unknown; error: unknown }) {
  const calls: Record<string, unknown> = {};
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((col: string, val: unknown) => {
      calls[`eq:${col}`] = val;
      return chain;
    }),
    is: vi.fn((col: string, val: unknown) => {
      calls[`is:${col}`] = val;
      return chain;
    }),
    lt: vi.fn((col: string, val: unknown) => {
      calls[`lt:${col}`] = val;
      return chain;
    }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  return {
    admin: { from: vi.fn(() => chain) } as never,
    calls,
    chain,
  };
}

describe('findIncompleteSettlements', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks for paid intents with no side-effects marker', async () => {
    const { admin, calls } = makeAdmin({ data: [], error: null });
    await findIncompleteSettlements(admin);

    expect(calls['eq:status']).toBe(STATUS.PAYMENT_INTENTS.PAID);
    expect(calls['is:side_effects_at']).toBeNull();
    // Only rows old enough that settlement cannot still be in flight — a
    // detector that reports mid-flight work gets ignored.
    expect(typeof calls['lt:paid_at']).toBe('string');
    expect(Date.parse(calls['lt:paid_at'] as string)).toBeLessThan(Date.now());
  });

  it('says nothing when every paid intent completed', async () => {
    const { admin } = makeAdmin({ data: [], error: null });
    const result = await findIncompleteSettlements(admin);

    expect(result).toEqual({ count: 0, ids: [] });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('reports loudly, naming the intents, when settlement was lost', async () => {
    const { admin } = makeAdmin({
      data: [{ id: 'pi-1' }, { id: 'pi-2' }],
      error: null,
    });
    const result = await findIncompleteSettlements(admin);

    expect(result.count).toBe(2);
    expect(result.ids).toEqual(['pi-1', 'pi-2']);
    // error, not warn: a buyer paid and their order never moved.
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [, payload] = (logger.error as Mock).mock.calls[0];
    expect(payload.paymentIntentIds).toEqual(['pi-1', 'pi-2']);
  });

  it('never throws the sweep away when the check itself fails', async () => {
    const { admin } = makeAdmin({ data: null, error: { message: 'boom' } });
    const result = await findIncompleteSettlements(admin);

    // The reconciliation half is load-bearing and must still run…
    expect(result).toEqual({ count: 0, ids: [] });
    // …but a detector that goes quiet on error is indistinguishable from one
    // finding nothing, which is the exact bug this exists to end.
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('does not attempt to repair anything', async () => {
    // Replaying settlement looks like the obvious fix and is a worse bug:
    // decrement_inventory is a blind `inventory_count - 1` with no idempotency
    // key, so a replay quietly destroys stock. Detection only, on purpose.
    const { admin, chain } = makeAdmin({ data: [{ id: 'pi-1' }], error: null });
    await findIncompleteSettlements(admin);

    expect(chain).not.toHaveProperty('update');
    expect((chain.select as Mock).mock.calls[0][0]).toBe('id');
  });
});
