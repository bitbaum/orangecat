/**
 * A payment remembers what it was worth when it arrived.
 *
 * The exactly-once paid transition records `rates_at_paid` — the BTC price per
 * currency at that moment — in the SAME update that sets status and paid_at,
 * so the value and the date can never disagree. Income is valued on the day it
 * is received; without this, every fiat figure converted a year of income at
 * today's price.
 *
 * And a missing rate must cost nothing: the payment has already happened, so
 * it is still marked paid, with an honest null instead of a guessed price.
 */

import { settleVerifiedPayment } from '@/domain/payments/paymentSettlement';
import { getAdminClient } from '@/lib/supabase/admin';
import { ratesAtReceiptOrNull } from '@/services/currency/rates.server';
import type { PaymentIntent } from '@/domain/payments/types';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/services/currency/rates.server', () => ({ ratesAtReceiptOrNull: vi.fn() }));
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/services/webhooks/paymentSettledWebhook', () => ({
  enqueuePaymentSettledWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/email/send-seller-notification', () => ({
  sendSellerPaymentNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/domain/events/tickets', () => ({ issuePaidTicket: vi.fn() }));
vi.mock('@/domain/events/notify', () => ({ notifyTicketIssued: vi.fn() }));
vi.mock('@/services/loki/entitlement-notify', () => ({
  notifyLokiEntitlement: vi.fn(),
  notifyLokiProjectFunding: vi.fn(),
}));
vi.mock('@/services/supporter/grant', () => ({ grantSupporterPlan: vi.fn() }));

/** Admin client that records every payment_intents update payload. */
function recordingAdmin() {
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    from: vi.fn(() => {
      const b: Record<string, unknown> = {};
      b.update = vi.fn((payload: Record<string, unknown>) => {
        updates.push(payload);
        return b;
      });
      b.eq = vi.fn(() => b);
      b.neq = vi.fn(() => b);
      // The claim's `.select('id')` resolves the conditional update: one row
      // moved, so this caller won the transition.
      b.select = vi.fn(() => Promise.resolve({ data: [{ id: 'pi-1' }], error: null }));
      // markSideEffectsComplete awaits the update chain itself.
      b.then = (resolve: (v: unknown) => void) => resolve({ error: null });
      return b;
    }),
  };
  return { client, updates };
}

const tip = {
  id: 'pi-1',
  intent_kind: 'tip',
  seller_id: 'seller-1',
  amount_btc: 0.001,
  entity_type: null,
  entity_id: null,
} as unknown as PaymentIntent;

beforeEach(() => vi.clearAllMocks());

describe('the paid transition records what the payment was worth', () => {
  it('writes rates_at_paid in the same update as status and paid_at', async () => {
    const admin = recordingAdmin();
    (getAdminClient as Mock).mockReturnValue(admin.client);
    (ratesAtReceiptOrNull as Mock).mockResolvedValue({ CHF: 52199, EUR: 55800 });

    await settleVerifiedPayment(tip);

    const claim = admin.updates.find(u => u.status === 'paid');
    expect(claim).toMatchObject({
      status: 'paid',
      rates_at_paid: { CHF: 52199, EUR: 55800 },
    });
    expect(typeof claim!.paid_at).toBe('string');
  });

  it('still marks the payment paid when no rate is available — with null, never a guess', async () => {
    const admin = recordingAdmin();
    (getAdminClient as Mock).mockReturnValue(admin.client);
    (ratesAtReceiptOrNull as Mock).mockResolvedValue(null);

    await settleVerifiedPayment(tip);

    const claim = admin.updates.find(u => u.status === 'paid');
    expect(claim).toMatchObject({ status: 'paid', rates_at_paid: null });
  });
});
