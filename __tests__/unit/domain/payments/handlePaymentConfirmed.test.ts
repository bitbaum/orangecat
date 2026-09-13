/**
 * handlePaymentConfirmed (via the on-chain confirmed path of checkPaymentStatus).
 *
 * On a verified payment we must mark it PAID and advance the order — but a
 * failed order update must NOT throw (the buyer's payment really succeeded and
 * the terminal-status short-circuit means a retry won't re-run this). It must,
 * however, be logged loudly for reconciliation rather than failing silently.
 */

import { checkPaymentStatus } from '@/domain/payments/paymentFlowService';
import { STATUS } from '@/config/database-constants';
import { logger } from '@/utils/logger';
import { checkOnchainPaymentStatus } from '@/domain/payments/paymentStatusService';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/email/send-seller-notification', () => ({
  sendSellerPaymentNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/domain/payments/paymentStatusService', () => ({
  checkNWCPaymentStatus: vi.fn(),
  checkOnchainPaymentStatus: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/services/webhooks/paymentSettledWebhook', () => ({
  enqueuePaymentSettledWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/loki/entitlement-notify', () => ({
  notifyLokiEntitlement: vi.fn().mockResolvedValue(undefined),
  notifyLokiProjectFunding: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/supporter/grant', () => ({
  grantSupporterPlan: vi.fn().mockResolvedValue(undefined),
}));

import { getAdminClient } from '@/lib/supabase/admin';

import type { Mock } from 'vitest';

const getAdminClientMock = getAdminClient as Mock;
const errorMock = logger.error as Mock;
const onchainMock = checkOnchainPaymentStatus as Mock;
const dispatchMock = NotificationDispatcher.dispatch as Mock;

const PI_ID = 'pi-1';
const BUYER = 'buyer-1';
const SELLER = 'seller-1';

const onchainIntent = {
  id: PI_ID,
  buyer_id: BUYER,
  seller_id: 'seller-1',
  status: STATUS.PAYMENT_INTENTS.INVOICE_READY,
  payment_method: 'onchain',
  intent_kind: 'purchase',
  onchain_address: 'bc1qxyz',
  entity_type: 'product', // fixed_price
  entity_id: 'prod-1',
  amount_btc: 0.01,
  description: 'Product: Blue Mug',
  paid_at: null,
  expires_at: null,
};

/**
 * Caller client serves the intent READ (single()); every status-transition
 * write now goes through the admin client (RLS lesson — see
 * buyerConfirmPayment.test.ts). makeSupabase wires both and installs the admin
 * mock, whose awaited chains resolve from a queue in order:
 *   [ paid-transition claim (returns the row = we won), order update ]
 */
function makeSupabase(orderUpdateError: unknown, intent: unknown = onchainIntent) {
  const awaitQueue: Array<{ data?: unknown; error: unknown }> = [
    { data: [{ id: PI_ID }], error: null },
    { error: orderUpdateError },
  ];
  const adminBuilder: Record<string, unknown> = {};
  for (const m of ['select', 'update', 'eq', 'neq', 'in']) {
    adminBuilder[m] = vi.fn(() => adminBuilder);
  }
  adminBuilder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(awaitQueue.shift() ?? { error: null }).then(resolve, reject);
  const rpc = vi.fn(() => Promise.resolve({ error: null }));
  getAdminClientMock.mockReturnValue({ from: vi.fn(() => adminBuilder), rpc });

  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'update', 'eq', 'neq', 'in']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve({ data: intent, error: null }));
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve, reject);
  return { from: vi.fn(() => builder), rpc: vi.fn() } as never;
}

/** A tip intent: entity-less, kind='tip'. Confirming it must NOT touch orders or
 *  getEntityMetadata (which would throw on a null entity_type). */
const tipIntent = {
  id: PI_ID,
  buyer_id: null,
  seller_id: SELLER,
  status: STATUS.PAYMENT_INTENTS.INVOICE_READY,
  payment_method: 'onchain',
  intent_kind: 'tip',
  onchain_address: 'bc1qtip',
  entity_type: null,
  entity_id: null,
  amount_btc: 0.0005,
  description: 'Tip for Bob',
  paid_at: null,
  expires_at: null,
};

/** Caller reads `intent`; the tip path only awaits ONE admin write (mark paid). */
function makeSupabaseReturning(intent: unknown) {
  return makeSupabase(null, intent);
}

beforeEach(() => {
  vi.clearAllMocks();
  onchainMock.mockResolvedValue('confirmed');
});

describe('handlePaymentConfirmed via checkPaymentStatus (onchain confirmed)', () => {
  it('returns PAID on a confirmed on-chain payment', async () => {
    const supabase = makeSupabase(null);
    const res = await checkPaymentStatus(supabase, PI_ID, BUYER);
    expect(res.status).toBe(STATUS.PAYMENT_INTENTS.PAID);
  });

  it('does not throw but logs for reconciliation when the order update fails', async () => {
    const supabase = makeSupabase({ message: 'db down' });
    const res = await checkPaymentStatus(supabase, PI_ID, BUYER);
    // Payment succeeded — must still report PAID to the buyer.
    expect(res.status).toBe(STATUS.PAYMENT_INTENTS.PAID);
    // ...but the stuck order must be logged loudly.
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining('reconciliation'),
      expect.objectContaining({ paymentIntentId: PI_ID })
    );
  });
});

describe('handlePaymentConfirmed — tip branch', () => {
  it('settles an entity-less tip and notifies the recipient (no entity side-effects)', async () => {
    const supabase = makeSupabaseReturning(tipIntent);
    // The recipient (seller) polling their own tip; a null entity_type must not throw.
    const res = await checkPaymentStatus(supabase, PI_ID, SELLER);

    expect(res.status).toBe(STATUS.PAYMENT_INTENTS.PAID);
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: SELLER,
        type: 'payment',
        title: expect.stringContaining('tip'),
        data: expect.objectContaining({ kind: 'tip', amount_btc: 0.0005 }),
      })
    );
    // No reconciliation error path — a tip has no order to get stuck.
    expect(errorMock).not.toHaveBeenCalled();
  });
});
