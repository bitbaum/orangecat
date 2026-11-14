/**
 * A purchase without an account is a real order: what checkout refuses before
 * anyone pays, and what the seller is left holding once someone does.
 *
 * Measured on orangecat.ch (2026-11-13): a signed-out buyer of a CHF 20 product
 * was shown the seller's bare address and told to type the amount, and nothing
 * recorded the purchase.
 */
const resolveAmount = vi.fn();
const resolveSellerWallet = vi.fn();
const getSellerUserId = vi.fn();
const generateInvoice = vi.fn();

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/domain/payments/walletResolutionService', () => ({
  resolveSellerWallet: (...a: unknown[]) => resolveSellerWallet(...a),
  getSellerUserId: (...a: unknown[]) => getSellerUserId(...a),
}));
vi.mock('@/domain/payments/invoiceGenerationService', () => ({
  generateInvoice: (...a: unknown[]) => generateInvoice(...a),
}));
vi.mock('@/domain/payments/paymentFlowHelpers', async importOriginal => ({
  ...(await importOriginal<typeof import('@/domain/payments/paymentFlowHelpers')>()),
  resolveAmount: (...a: unknown[]) => resolveAmount(...a),
  getEntityTitle: async () => 'Morning with Cat',
}));

import { getAdminClient } from '@/lib/supabase/admin';
import { GuestPurchaseError, initiateGuestPurchase } from '@/domain/payments/guestPurchase';
import { hashPublicStatusToken } from '@/domain/payments/paymentFlowHelpers';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { createFakeSupabase, type FakeSupabaseOptions } from '../../../../test-utils/fakeSupabase';
import type { Mock } from 'vitest';

const PRODUCT_ID = 'prod-1';

function world(published = true, options: FakeSupabaseOptions = {}) {
  const pub = createFakeSupabase({
    [ENTITY_REGISTRY.product.tableName]: published ? [{ id: PRODUCT_ID }] : [],
    [ENTITY_REGISTRY.service.tableName]: [{ id: PRODUCT_ID }],
    [ENTITY_REGISTRY.event.tableName]: [{ id: PRODUCT_ID }],
    [ENTITY_REGISTRY.project.tableName]: [{ id: PRODUCT_ID }],
  });
  const admin = createFakeSupabase(
    { [DATABASE_TABLES.PAYMENT_INTENTS]: [], [DATABASE_TABLES.ORDERS]: [] },
    options
  );
  (getAdminClient as Mock).mockReturnValue(admin.client);
  return { pub, admin };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveAmount.mockResolvedValue(0.00034628);
  getSellerUserId.mockResolvedValue('seller-1');
  resolveSellerWallet.mockResolvedValue({ method: 'nwc', wallet_id: 'w1' });
  generateInvoice.mockResolvedValue({
    method: 'nwc',
    bolt11: 'lnbc1',
    payment_hash: 'h1',
    onchain_address: null,
    lnurl_verify_url: null,
    expires_at: null,
    qr_data: 'LNBC1',
  });
});

const buy = (
  pub: ReturnType<typeof world>['pub'],
  over: Partial<{ entityType: EntityType; name: string; note: string | null }> = {}
) =>
  initiateGuestPurchase(pub.client, {
    entityType: 'product',
    entityId: PRODUCT_ID,
    name: '  Ana  ',
    note: '  ana@example.org  ',
    ...over,
  });

describe('a purchase without an account', () => {
  it('invoices the listing price to the seller and writes the order the seller will see', async () => {
    const { pub, admin } = world();
    const result = await buy(pub);

    const [intent, order] = admin.inserts;
    expect(intent.table).toBe(DATABASE_TABLES.PAYMENT_INTENTS);
    expect(intent.values).toMatchObject({
      buyer_id: null,
      guest_name: 'Ana',
      seller_id: 'seller-1',
      entity_type: 'product',
      entity_id: PRODUCT_ID,
      amount_btc: 0.00034628,
      intent_kind: 'purchase',
      receiving_wallet_id: 'w1',
    });
    expect(order.table).toBe(DATABASE_TABLES.ORDERS);
    expect(order.values).toMatchObject({
      buyer_id: null,
      seller_id: 'seller-1',
      entity_type: 'product',
      entity_id: PRODUCT_ID,
      amount_btc: 0.00034628,
      entity_title: 'Morning with Cat',
      status: STATUS.ORDERS.PENDING_PAYMENT,
      buyer_note: 'ana@example.org',
    });
    // The bearer token is returned once and only its hash is stored.
    expect((intent.values as Record<string, unknown>).public_status_token_hash).toBe(
      hashPublicStatusToken(result.status_token)
    );
    expect(result.qr_data).toBe('LNBC1');
    // NWC proves payment by itself: no "I've paid".
    expect(result.payment_intent.can_acknowledge).toBe(false);
  });

  it('charges the price the server reads, never one the caller sends', async () => {
    const { pub } = world();
    await buy(pub);
    // resolveAmount is asked with no input amount: the listing's price is the price.
    expect(resolveAmount).toHaveBeenCalledWith(expect.anything(), 'product', PRODUCT_ID);
    expect(generateInvoice).toHaveBeenCalledWith(
      expect.anything(),
      0.00034628,
      'Product: Morning with Cat'
    );
  });

  it('withdraws the invoice when the order cannot be written', async () => {
    const { pub, admin } = world(true, {
      insertError: { [DATABASE_TABLES.ORDERS]: { message: 'boom' } },
    });
    await expect(buy(pub)).rejects.toThrow('Failed to create guest order');
    // No order behind it would be the bare address again: the intent is gone.
    expect(admin.deletes).toEqual([
      { table: DATABASE_TABLES.PAYMENT_INTENTS, match: { id: undefined } },
    ]);
    expect(admin.tables[DATABASE_TABLES.ORDERS]).toEqual([]);
  });

  it.each([
    ['a service, which is booked first and paid on acceptance', 'service'],
    ['an event, whose guest path issues the ticket', 'event'],
    ['a project, which is supported, not bought', 'project'],
  ] as const)('refuses %s', async (_label, entityType) => {
    const { pub, admin } = world();
    await expect(buy(pub, { entityType })).rejects.toMatchObject({ status: 400 });
    expect(generateInvoice).not.toHaveBeenCalled();
    expect(admin.inserts).toEqual([]);
  });

  it.each([
    ['an empty name', { name: '   ' }],
    ['a name too long', { name: 'x'.repeat(81) }],
    ['a note too long', { note: 'x'.repeat(501) }],
  ])('refuses %s before any invoice', async (_label, over) => {
    const { pub, admin } = world();
    await expect(buy(pub, over)).rejects.toMatchObject({ status: 400 });
    expect(generateInvoice).not.toHaveBeenCalled();
    expect(admin.inserts).toEqual([]);
  });

  it('takes an order with no note', async () => {
    const { pub, admin } = world();
    await buy(pub, { note: null });
    expect(admin.inserts[1].values).toMatchObject({ buyer_note: null });
  });

  it('refuses a listing that is not published', async () => {
    const { pub } = world(false);
    await expect(buy(pub)).rejects.toMatchObject({ status: 404 });
    expect(generateInvoice).not.toHaveBeenCalled();
  });

  it('refuses rather than guess when there is no Bitcoin price', async () => {
    resolveAmount.mockRejectedValue(new Error('Bitcoin exchange rate unavailable for CHF'));
    const { pub } = world();
    await expect(buy(pub)).rejects.toMatchObject({ status: 503 });
    expect(generateInvoice).not.toHaveBeenCalled();
  });

  it('says so when the seller has no wallet', async () => {
    resolveSellerWallet.mockResolvedValue(null);
    const { pub, admin } = world();
    const error = await buy(pub).catch(e => e);
    expect(error).toBeInstanceOf(GuestPurchaseError);
    expect(error.message).toMatch(/wallet/);
    expect(admin.inserts).toEqual([]);
  });
});
