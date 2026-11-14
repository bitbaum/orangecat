/**
 * A service is booked first and paid once the provider accepts.
 *
 * Measured on orangecat.ch (2026-11-13): "Book this" and "Buy Now (CHF 1,000)"
 * sat on one service page and never met; an accepted booking was paid to a bare
 * address and nothing ever told the booking so.
 */
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
  getEntityTitle: async () => 'Custom Portrait Painting',
}));

import { getAdminClient } from '@/lib/supabase/admin';
import {
  BookingPaymentError,
  initiateBookingPayment,
  settleOrderOfPayment,
} from '@/domain/payments/bookingPayment';
import { bookingAmountDueBtc, isBookingPayable } from '@/domain/bookings/payment';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { createFakeSupabase } from '../../../../test-utils/fakeSupabase';
import type { Mock } from 'vitest';

const BOOKING_ID = 'booking-1';
const CUSTOMER = 'customer-1';

const booking = (over: Record<string, unknown> = {}) => ({
  id: BOOKING_ID,
  bookable_type: 'service',
  bookable_id: 'service-1',
  customer_user_id: CUSTOMER,
  status: STATUS.BOOKINGS.CONFIRMED,
  price_btc: 0.0173,
  total_paid_btc: 0,
  ...over,
});

function world(row: Record<string, unknown> | null = booking()) {
  const user = createFakeSupabase({ [DATABASE_TABLES.BOOKINGS]: row ? [row] : [] });
  const admin = createFakeSupabase({
    [DATABASE_TABLES.PAYMENT_INTENTS]: [],
    [DATABASE_TABLES.ORDERS]: [],
  });
  (getAdminClient as Mock).mockReturnValue(admin.client);
  return { user, admin };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSellerUserId.mockResolvedValue('provider-1');
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

describe('when a booking can be paid', () => {
  it.each([
    [STATUS.BOOKINGS.PENDING, false],
    [STATUS.BOOKINGS.CONFIRMED, true],
    [STATUS.BOOKINGS.IN_PROGRESS, true],
    [STATUS.BOOKINGS.REJECTED, false],
    [STATUS.BOOKINGS.CANCELLED, false],
    [STATUS.BOOKINGS.COMPLETED, false],
  ])('%s → %s', (status, payable) => {
    expect(isBookingPayable(booking({ status }))).toBe(payable);
  });

  it('is not payable once paid, or when it has no price', () => {
    expect(isBookingPayable(booking({ total_paid_btc: 0.0173 }))).toBe(false);
    expect(isBookingPayable(booking({ price_btc: 0 }))).toBe(false);
  });

  it('owes what is left, and nothing for a rounding remainder', () => {
    expect(bookingAmountDueBtc({ price_btc: 0.0173, total_paid_btc: 0.0073 })).toBe(0.01);
    expect(bookingAmountDueBtc({ price_btc: '0.0173', total_paid_btc: 0.017299999 })).toBe(0);
  });
});

describe('the customer pays an accepted booking', () => {
  it('invoices the booking price to the provider and ties the order to the booking', async () => {
    const { user, admin } = world();
    const result = await initiateBookingPayment(user.client, CUSTOMER, BOOKING_ID);

    // The wallet is the one resolved for the booked listing — who is paid does not change.
    expect(resolveSellerWallet).toHaveBeenCalledWith('service', 'service-1');
    expect(generateInvoice).toHaveBeenCalledWith(
      expect.anything(),
      0.0173,
      'Service: Custom Portrait Painting'
    );
    const [intent, order] = admin.inserts;
    expect(intent.values).toMatchObject({
      buyer_id: CUSTOMER,
      seller_id: 'provider-1',
      entity_type: 'service',
      entity_id: 'service-1',
      amount_btc: 0.0173,
      intent_kind: 'purchase',
    });
    expect(order.table).toBe(DATABASE_TABLES.ORDERS);
    expect(order.values).toMatchObject({
      booking_id: BOOKING_ID,
      buyer_id: CUSTOMER,
      seller_id: 'provider-1',
      amount_btc: 0.0173,
      status: STATUS.ORDERS.PENDING_PAYMENT,
    });
    expect(result.qr_data).toBe('LNBC1');
  });

  it.each([
    ['is still waiting for the provider', { status: STATUS.BOOKINGS.PENDING }, 409],
    ['was declined', { status: STATUS.BOOKINGS.REJECTED }, 409],
    ['is already paid', { total_paid_btc: 0.0173 }, 409],
    ['belongs to someone else', { customer_user_id: 'other' }, 403],
  ])('refuses a booking that %s', async (_label, over, status) => {
    const { user, admin } = world(booking(over));
    await expect(initiateBookingPayment(user.client, CUSTOMER, BOOKING_ID)).rejects.toMatchObject({
      status,
    });
    expect(generateInvoice).not.toHaveBeenCalled();
    expect(admin.inserts).toEqual([]);
  });

  it('refuses a booking the customer cannot see', async () => {
    const { user } = world(null);
    await expect(initiateBookingPayment(user.client, CUSTOMER, BOOKING_ID)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('says so when the provider has no wallet', async () => {
    resolveSellerWallet.mockResolvedValue(null);
    const { user, admin } = world();
    const error = await initiateBookingPayment(user.client, CUSTOMER, BOOKING_ID).catch(e => e);
    expect(error).toBeInstanceOf(BookingPaymentError);
    expect(error.message).toMatch(/wallet/);
    expect(admin.inserts).toEqual([]);
  });
});

describe('settlement marks the order and its booking paid', () => {
  const settled = (orders: Record<string, unknown>[], paidSoFar = 0) =>
    createFakeSupabase({
      [DATABASE_TABLES.ORDERS]: orders,
      [DATABASE_TABLES.BOOKINGS]: [booking({ total_paid_btc: paidSoFar })],
    });

  it('records the amount on the booking', async () => {
    const admin = settled([
      {
        id: 'o1',
        payment_intent_id: 'pi-1',
        booking_id: BOOKING_ID,
        status: STATUS.ORDERS.PENDING_PAYMENT,
      },
    ]);
    await settleOrderOfPayment(admin.client, { id: 'pi-1', amount_btc: 0.0173 });
    expect(admin.tables[DATABASE_TABLES.ORDERS][0].status).toBe(STATUS.ORDERS.PAID);
    expect(admin.tables[DATABASE_TABLES.BOOKINGS][0].total_paid_btc).toBe(0.0173);
  });

  it('marks an ordinary order paid and touches no booking', async () => {
    const admin = settled([
      { id: 'o1', payment_intent_id: 'pi-1', booking_id: null, status: 'pending_payment' },
    ]);
    await settleOrderOfPayment(admin.client, { id: 'pi-1', amount_btc: 0.0002 });
    expect(admin.tables[DATABASE_TABLES.ORDERS][0].status).toBe(STATUS.ORDERS.PAID);
    expect(admin.updates.map(u => u.table)).toEqual([DATABASE_TABLES.ORDERS]);
  });

  it('never moves an order back from a later state', async () => {
    const admin = settled([
      { id: 'o1', payment_intent_id: 'pi-1', booking_id: BOOKING_ID, status: 'shipped' },
    ]);
    await settleOrderOfPayment(admin.client, { id: 'pi-1', amount_btc: 0.0173 });
    expect(admin.tables[DATABASE_TABLES.ORDERS][0].status).toBe('shipped');
    expect(admin.tables[DATABASE_TABLES.BOOKINGS][0].total_paid_btc).toBe(0);
  });

  it('does not throw when the write fails: the money has already moved', async () => {
    const admin = createFakeSupabase(
      { [DATABASE_TABLES.ORDERS]: [] },
      { updateError: { message: 'down' } }
    );
    await expect(
      settleOrderOfPayment(admin.client, { id: 'pi-1', amount_btc: 0.0173 })
    ).resolves.toBeUndefined();
  });
});
