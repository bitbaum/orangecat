/**
 * buyerConfirmPayment / sellerConfirmPayment — state-transition correctness +
 * trust-boundary guard.
 *
 * A buyer acknowledging an unverifiable payment flips only the intent to
 * BUYER_CONFIRMED. It must not mark money or an order paid: the recipient
 * still has to verify their wallet. A swallowed DB error used to let this
 * return success while the intent stayed stale; these tests lock in that
 * failures surface instead of silently diverging money state from reality.
 *
 * They also lock the trust boundary: manual self-attestation is refused on any
 * rail we confirm automatically (NWC, verify-capable Lightning addresses,
 * on-chain). Only a bare Lightning address with no LUD-21 verify URL may be
 * self-attested — the buyer's word must never flip an order to paid over a
 * trustworthy on-rail signal.
 *
 * And they pin the RLS lesson: ALL status transitions write through the admin
 * client. RLS grants UPDATE on payment_intents to buyers only, so a
 * seller-scoped client updates zero rows with no error — the recipient's
 * confirmation silently changed nothing while the API reported paid.
 */

import { buyerConfirmPayment, sellerConfirmPayment } from '@/domain/payments/paymentFlowService';
import { getAdminClient } from '@/lib/supabase/admin';
import { STATUS } from '@/config/database-constants';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
// Break the resend/email import chain (ESM-only, not transformed by jest).
vi.mock('@/lib/email/send-seller-notification', () => ({
  sendSellerPaymentNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
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

const getAdminClientMock = getAdminClient as Mock;
const dispatchMock = NotificationDispatcher.dispatch as Mock;

const PI_ID = 'pi-1';
const BUYER = 'buyer-1';

/**
 * Caller-scoped client: READS only (the intent lookup). Its update builder is
 * instrumented so tests can assert the caller client is never used to write.
 */
function makeCallerSupabase(intent: Record<string, unknown> | null) {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'update', 'eq', 'neq', 'in']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve({ data: intent, error: null }));
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: intent, error: null }));
  // An awaited caller-client write behaves like RLS silently filtering the row:
  // zero rows, no error. If production code ever writes through this client
  // again, the assertions on the admin client below will catch it.
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve, reject);
  return { supabase: { from: vi.fn(() => builder) } as never, builder };
}

/** Admin client: serves all status-transition writes, in call order. */
function makeAdmin(awaitQueue: Array<{ data?: unknown; error: unknown }>) {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'update', 'eq', 'neq', 'in']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(awaitQueue.shift() ?? { data: [{ id: PI_ID }], error: null }).then(
      resolve,
      reject
    );
  const rpc = vi.fn(() => Promise.resolve({ error: null }));
  const admin = { from: vi.fn(() => builder), rpc };
  return { admin, builder };
}

const fixedPriceIntent = {
  id: PI_ID,
  status: STATUS.PAYMENT_INTENTS.INVOICE_READY,
  entity_type: 'product',
  paid_at: null,
  // A bare Lightning address (no LUD-21 verify URL) is the ONLY rail eligible for
  // manual confirmation; every other method is auto-detected and now refused.
  payment_method: 'lightning_address',
  lnurl_verify_url: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getAdminClientMock.mockReturnValue(makeAdmin([]).admin);
});

describe('buyerConfirmPayment', () => {
  it('throws when the payment intent is not found', async () => {
    const { supabase } = makeCallerSupabase(null);
    await expect(buyerConfirmPayment(supabase, PI_ID, BUYER)).rejects.toThrow('Payment not found');
  });

  it('is idempotent when already paid', async () => {
    const { supabase } = makeCallerSupabase({
      ...fixedPriceIntent,
      status: STATUS.PAYMENT_INTENTS.PAID,
      paid_at: 'ts',
    });
    const res = await buyerConfirmPayment(supabase, PI_ID, BUYER);
    expect(res.status).toBe(STATUS.PAYMENT_INTENTS.PAID);
  });

  it('confirms and returns BUYER_CONFIRMED on success', async () => {
    const { supabase } = makeCallerSupabase(fixedPriceIntent);
    const res = await buyerConfirmPayment(supabase, PI_ID, BUYER);
    expect(res.status).toBe(STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED);
  });

  it('surfaces a failed intent status update instead of reporting success', async () => {
    const { supabase } = makeCallerSupabase(fixedPriceIntent);
    getAdminClientMock.mockReturnValue(
      makeAdmin([{ data: null, error: { message: 'db down' } }]).admin
    );
    await expect(buyerConfirmPayment(supabase, PI_ID, BUYER)).rejects.toThrow(
      'Failed to update payment status'
    );
  });

  it('does not finalize an order before the recipient confirms receipt', async () => {
    const { supabase } = makeCallerSupabase(fixedPriceIntent);
    const res = await buyerConfirmPayment(supabase, PI_ID, BUYER);
    expect(res).toEqual({
      status: STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED,
      paid_at: null,
    });
  });

  it('notifies the recipient of the claim — once, on the actual transition', async () => {
    const intent = { ...fixedPriceIntent, seller_id: 'seller-1', amount_btc: 0.0001 };
    const { supabase } = makeCallerSupabase(intent);
    await buyerConfirmPayment(supabase, PI_ID, BUYER);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'seller-1',
        type: 'payment',
        data: expect.objectContaining({ kind: 'buyer_claim' }),
      })
    );

    // Re-claim is idempotent: no state write, no second notification.
    dispatchMock.mockClear();
    const { supabase: again } = makeCallerSupabase({
      ...intent,
      status: STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED,
    });
    const res = await buyerConfirmPayment(again, PI_ID, BUYER);
    expect(res.status).toBe(STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['NWC', { payment_method: 'nwc', payment_hash: 'h' }],
    ['on-chain', { payment_method: 'onchain', onchain_address: 'bc1qxyz' }],
    [
      'a verify-capable Lightning address',
      { payment_method: 'lightning_address', lnurl_verify_url: 'https://ln/verify' },
    ],
  ])('refuses manual confirmation for an auto-detected rail: %s', async (_label, rail) => {
    // Detectable rail → the guard throws before any state change (no write reached).
    const { supabase } = makeCallerSupabase({ ...fixedPriceIntent, ...rail });
    await expect(buyerConfirmPayment(supabase, PI_ID, BUYER)).rejects.toThrow(
      'This payment is confirmed automatically'
    );
  });
});

describe('sellerConfirmPayment', () => {
  const publicSupportIntent = {
    ...fixedPriceIntent,
    buyer_id: null,
    seller_id: 'seller-1',
    status: STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED,
    entity_type: 'project',
    entity_id: 'project-1',
    intent_kind: 'support',
    amount_btc: 0.0001,
    description: 'Support: Neighbourhood club',
  };

  it('marks an acknowledged bare-Lightning payment paid after recipient verification', async () => {
    const { supabase } = makeCallerSupabase(publicSupportIntent);
    const res = await sellerConfirmPayment(supabase, PI_ID, 'seller-1');
    expect(res.status).toBe(STATUS.PAYMENT_INTENTS.PAID);
  });

  it('refuses recipient confirmation unless the payment awaits it', async () => {
    const { supabase } = makeCallerSupabase({
      ...publicSupportIntent,
      status: STATUS.PAYMENT_INTENTS.INVOICE_READY,
    });
    await expect(sellerConfirmPayment(supabase, PI_ID, 'seller-1')).rejects.toThrow(
      'Payment is not awaiting recipient confirmation'
    );
  });

  it('settles through the ADMIN client — never the seller-scoped caller client', async () => {
    // Regression (found live 2026-08-02): RLS grants UPDATE on payment_intents
    // to buyers only. Writing the paid transition through the seller's client
    // updated zero rows with no error, was misread as "another observer already
    // settled it", skipped every side-effect — and still answered "paid". The
    // recipient-confirmation flow had never actually worked in production.
    const { supabase, builder: callerBuilder } = makeCallerSupabase(publicSupportIntent);
    const { admin, builder: adminBuilder } = makeAdmin([]);
    getAdminClientMock.mockReturnValue(admin);

    const res = await sellerConfirmPayment(supabase, PI_ID, 'seller-1');

    expect(res.status).toBe(STATUS.PAYMENT_INTENTS.PAID);
    // The transition itself must run on the admin client…
    expect(adminBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: STATUS.PAYMENT_INTENTS.PAID })
    );
    // …and the caller's RLS-scoped client must never be asked to write.
    expect(callerBuilder.update).not.toHaveBeenCalled();
    // Side-effects actually ran: the recipient got their notification.
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'seller-1', type: 'payment' })
    );
  });
});
