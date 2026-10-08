/**
 * Money records are written by the server only.
 *
 * initiatePayment used to insert the payment intent, the order and the
 * contribution through the BUYER's session, unlike every other payment path.
 * The buyer's session is still the publication gate (what they may see); these
 * pin that it is used for NOTHING else: the buyer client below throws on any
 * write, so a regression fails here instead of in production.
 */

import { initiatePayment } from '@/domain/payments/paymentFlowService';
import { getSellerUserId, resolveSellerWallet } from '@/domain/payments/walletResolutionService';
import { generateInvoice } from '@/domain/payments/invoiceGenerationService';
import { getAdminClient } from '@/lib/supabase/admin';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/domain/payments/walletResolutionService', () => ({
  getSellerUserId: vi.fn(),
  resolveSellerWallet: vi.fn(),
}));
vi.mock('@/domain/payments/invoiceGenerationService', () => ({ generateInvoice: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/domain/payments/paymentFlowHelpers', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveAmount: vi.fn().mockResolvedValue(0.001),
  getEntityTitle: vi.fn().mockResolvedValue('A thing'),
}));
vi.mock('@/lib/email/send-seller-notification', () => ({
  sendSellerPaymentNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));

const BUYER = 'buyer-1';

/** The buyer's session: may read (the publication gate), must never write. */
function buyerClient() {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: { id: 'e-1' }, error: null }));
  for (const m of ['insert', 'update', 'upsert', 'delete']) {
    builder[m] = vi.fn(() => {
      throw new Error(`the buyer's session must not ${m} money records`);
    });
  }
  return { from: vi.fn(() => builder) };
}

/** The server's client: records every insert, by table. */
function adminRecorder() {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const client = {
    from: vi.fn((table: string) => {
      const builder: Record<string, unknown> = {};
      builder.insert = vi.fn((row: Record<string, unknown>) => {
        inserts.push({ table, row });
        builder.select = vi.fn(() => builder);
        builder.single = vi.fn(() =>
          Promise.resolve({ data: { id: `${table}-id`, expires_at: null, ...row }, error: null })
        );
        return builder;
      });
      return builder;
    }),
  };
  return { client, inserts };
}

beforeEach(() => {
  vi.clearAllMocks();
  (getSellerUserId as Mock).mockResolvedValue('seller-1');
  (resolveSellerWallet as Mock).mockResolvedValue({
    method: 'lightning_address',
    wallet_id: 'w-1',
    lightning_address: 'seller@getalby.com',
  });
  (generateInvoice as Mock).mockResolvedValue({
    method: 'lightning_address',
    bolt11: 'lnbc10u1pinvoice',
    payment_hash: 'hash-1',
    onchain_address: null,
    lnurl_verify_url: null,
    expires_at: null,
  });
});

describe('initiatePayment writes money records through the server only', () => {
  it('a purchase: intent and order go through the server client', async () => {
    const admin = adminRecorder();
    (getAdminClient as Mock).mockReturnValue(admin.client);
    const buyer = buyerClient();

    await initiatePayment(buyer as never, BUYER, { entity_type: 'product', entity_id: 'e-1' });

    expect(admin.inserts.map(i => i.table)).toEqual(['payment_intents', 'orders']);
    // Every money fact comes from the server's resolution, not the client.
    expect(admin.inserts[0].row).toMatchObject({
      buyer_id: BUYER,
      seller_id: 'seller-1',
      amount_btc: 0.001,
      receiving_wallet_id: 'w-1',
    });
    expect(admin.inserts[0].row.status).not.toBe('paid');
  });

  it('support for a cause: intent and contribution go through the server client', async () => {
    const admin = adminRecorder();
    (getAdminClient as Mock).mockReturnValue(admin.client);

    await initiatePayment(buyerClient() as never, BUYER, {
      entity_type: 'cause',
      entity_id: 'e-1',
    });

    expect(admin.inserts.map(i => i.table)).toEqual(['payment_intents', 'contributions']);
    expect(admin.inserts[1].row).toMatchObject({ contributor_id: BUYER, amount_btc: 0.001 });
  });
});
