/**
 * A paid ticket without an account: what checkout refuses before anyone pays,
 * and what the intent carries to settlement.
 */
const getSeatsLeft = vi.fn();
const resolveAmount = vi.fn();
const resolveSellerWallet = vi.fn();
const getSellerUserId = vi.fn();
const generateInvoice = vi.fn();

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/domain/events/tickets', async importOriginal => ({
  ...(await importOriginal<typeof import('@/domain/events/tickets')>()),
  getSeatsLeft: (...a: unknown[]) => getSeatsLeft(...a),
}));
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
  getEntityTitle: async () => 'Electronic night',
}));

import { getAdminClient } from '@/lib/supabase/admin';
import {
  GuestTicketPurchaseError,
  initiateGuestTicketPurchase,
} from '@/domain/payments/guestTicketPurchase';
import { hashPublicStatusToken } from '@/domain/payments/paymentFlowHelpers';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { createFakeSupabase } from '../../../../test-utils/fakeSupabase';
import type { Mock } from 'vitest';

const EVENT_ID = 'event-1';

function world(published = true) {
  const pub = createFakeSupabase({
    [ENTITY_REGISTRY.event.tableName]: published ? [{ id: EVENT_ID }] : [],
  });
  const admin = createFakeSupabase({ [DATABASE_TABLES.PAYMENT_INTENTS]: [] });
  (getAdminClient as Mock).mockReturnValue(admin.client);
  return { pub, admin };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSeatsLeft.mockResolvedValue(null);
  resolveAmount.mockResolvedValue(0.0002);
  getSellerUserId.mockResolvedValue('org');
  resolveSellerWallet.mockResolvedValue({ method: 'lightning_address', wallet_id: 'w1' });
  generateInvoice.mockResolvedValue({
    method: 'lightning_address',
    bolt11: 'lnbc1',
    payment_hash: 'h1',
    onchain_address: null,
    lnurl_verify_url: null,
    expires_at: null,
    qr_data: 'LNBC1',
  });
});

const buy = (pub: ReturnType<typeof world>['pub'], name = '  Ana  ') =>
  initiateGuestTicketPurchase(pub.client, { eventId: EVENT_ID, name });

describe('a guest buys a ticket', () => {
  it('invoices the event price to the organizer and carries the name to settlement', async () => {
    const { pub, admin } = world();
    const result = await buy(pub);

    const row = admin.inserts[0].values as Record<string, unknown>;
    expect(row).toMatchObject({
      buyer_id: null,
      guest_name: 'Ana',
      seller_id: 'org',
      entity_type: 'event',
      entity_id: EVENT_ID,
      amount_btc: 0.0002,
      intent_kind: 'purchase',
    });
    // The bearer token is returned once and only its hash is stored.
    expect(row.public_status_token_hash).toBe(hashPublicStatusToken(result.status_token));
    expect(result.qr_data).toBe('LNBC1');
    // A bare Lightning address cannot prove payment: the guest may say they paid.
    expect(result.payment_intent.can_acknowledge).toBe(true);
  });

  it.each([
    ['an empty name', { name: '   ' }, 400],
    ['a name too long for the door list', { name: 'x'.repeat(81) }, 400],
  ])('refuses %s', async (_label, { name }, status) => {
    const { pub, admin } = world();
    await expect(buy(pub, name)).rejects.toMatchObject({ status });
    expect(admin.inserts).toEqual([]);
  });

  it('refuses an event that is not published', async () => {
    const { pub } = world(false);
    await expect(buy(pub)).rejects.toMatchObject({ status: 404 });
    expect(generateInvoice).not.toHaveBeenCalled();
  });

  it('refuses a sold-out event before anyone pays', async () => {
    getSeatsLeft.mockResolvedValue(0);
    const { pub } = world();
    await expect(buy(pub)).rejects.toThrow('sold out');
    expect(generateInvoice).not.toHaveBeenCalled();
  });

  it('sends a free event back to the name-only ticket', async () => {
    resolveAmount.mockRejectedValue(new Error('Entity has no price set'));
    const { pub } = world();
    await expect(buy(pub)).rejects.toThrow(/free/);
  });

  it('refuses rather than guess when there is no Bitcoin price', async () => {
    resolveAmount.mockRejectedValue(new Error('Bitcoin exchange rate unavailable for CHF'));
    const { pub } = world();
    await expect(buy(pub)).rejects.toMatchObject({ status: 503 });
    expect(generateInvoice).not.toHaveBeenCalled();
  });

  it('says so when the organizer has no wallet', async () => {
    resolveSellerWallet.mockResolvedValue(null);
    const { pub } = world();
    const error = await buy(pub).catch(e => e);
    expect(error).toBeInstanceOf(GuestTicketPurchaseError);
    expect(error.message).toMatch(/wallet/);
  });
});
