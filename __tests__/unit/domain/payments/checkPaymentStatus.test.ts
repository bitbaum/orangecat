/**
 * checkPaymentStatus — access control + lifecycle short-circuits.
 *
 * Security-relevant: only the buyer or seller of an intent may read its status.
 * Lifecycle: terminal states return immediately, and an expired invoice flips
 * to EXPIRED. Payment methods that require active relay/mempool checks are not
 * exercised here (covered by their own services); these tests use a method that
 * returns the current status without an external call.
 */

import { checkPaymentStatus } from '@/domain/payments/paymentFlowService';
import { STATUS } from '@/config/database-constants';
import { getAdminClient } from '@/lib/supabase/admin';
import type { Mock } from 'vitest';

const getAdminClientMock = getAdminClient as Mock;

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/email/send-seller-notification', () => ({
  sendSellerPaymentNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));

const PI_ID = 'pi-1';
const BUYER = 'buyer-1';
const SELLER = 'seller-1';

function makeSupabase(intent: Record<string, unknown> | null) {
  const update = vi.fn();
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'update', 'eq', 'in']) {
    builder[m] = vi.fn((...args: unknown[]) => {
      if (m === 'update') update(...args);
      return builder;
    });
  }
  builder.single = vi.fn(() => Promise.resolve({ data: intent, error: null }));
  // Awaited update chains resolve cleanly.
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve({ error: null }).then(resolve, reject);
  const client = { from: vi.fn(() => builder) } as never;
  getAdminClientMock.mockReturnValue(client);
  return { client, update };
}

const baseIntent = {
  id: PI_ID,
  buyer_id: BUYER,
  seller_id: SELLER,
  status: STATUS.PAYMENT_INTENTS.INVOICE_READY,
  payment_method: 'lightning_address', // no auto relay/mempool check
  paid_at: null,
  expires_at: null as string | null,
};

describe('checkPaymentStatus', () => {
  it('throws when the intent does not exist', async () => {
    const { client } = makeSupabase(null);
    await expect(checkPaymentStatus(client, PI_ID, BUYER)).rejects.toThrow('Payment not found');
  });

  it('denies access to a third party', async () => {
    const { client } = makeSupabase(baseIntent);
    await expect(checkPaymentStatus(client, PI_ID, 'intruder')).rejects.toThrow('Access denied');
  });

  it('allows the seller to read status', async () => {
    const { client } = makeSupabase(baseIntent);
    const res = await checkPaymentStatus(client, PI_ID, SELLER);
    expect(res.status).toBe(STATUS.PAYMENT_INTENTS.INVOICE_READY);
  });

  it('returns terminal status immediately without writing', async () => {
    const { client, update } = makeSupabase({
      ...baseIntent,
      status: STATUS.PAYMENT_INTENTS.PAID,
      paid_at: 'ts',
    });
    const res = await checkPaymentStatus(client, PI_ID, BUYER);
    expect(res).toEqual({ status: STATUS.PAYMENT_INTENTS.PAID, paid_at: 'ts' });
    expect(update).not.toHaveBeenCalled();
  });

  it('flips an expired invoice to EXPIRED', async () => {
    const { client, update } = makeSupabase({
      ...baseIntent,
      expires_at: '2000-01-01T00:00:00.000Z',
    });
    const res = await checkPaymentStatus(client, PI_ID, BUYER);
    expect(res.status).toBe(STATUS.PAYMENT_INTENTS.EXPIRED);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: STATUS.PAYMENT_INTENTS.EXPIRED })
    );
  });
});
