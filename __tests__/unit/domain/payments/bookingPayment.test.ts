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
vi.mock('@/domain/payments/invoiceGenerationService', async importOriginal => ({
  ...(await importOriginal<typeof import('@/domain/payments/invoiceGenerationService')>()),
  generateInvoice: (...a: unknown[]) => generateInvoice(...a),
}));
const reconcilePaymentIntent = vi.fn();
vi.mock('@/domain/payments/paymentStatusFlow', () => ({
  reconcilePaymentIntent: (...a: unknown[]) => reconcilePaymentIntent(...a),
}));
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/domain/payments/paymentFlowHelpers', async importOriginal => ({
  ...(await importOriginal<typeof import('@/domain/payments/paymentFlowHelpers')>()),
  getEntityTitle: async () => 'Custom Portrait Painting',
}));

import { getAdminClient } from '@/lib/supabase/admin';
import { BookingPaymentError, initiateBookingPayment } from '@/domain/payments/bookingPayment';
import { bookingPaidBtc, settleOrderOfPayment } from '@/domain/payments/bookingSettlement';
import { bookingAmountDueBtc, isBookingPayable } from '@/domain/bookings/payment';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
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

/**
 * `row` is the booking as the server holds it. `seen` is what the customer's
 * own session returns — the same row unless a test forges it.
 */
function world(
  row: Record<string, unknown> | null = booking(),
  extra: {
    seen?: Record<string, unknown> | null;
    orders?: Record<string, unknown>[];
    intents?: Record<string, unknown>[];
  } = {}
) {
  const seen = extra.seen === undefined ? row : extra.seen;
  const user = createFakeSupabase({ [DATABASE_TABLES.BOOKINGS]: seen ? [seen] : [] });
  const admin = createFakeSupabase({
    [DATABASE_TABLES.BOOKINGS]: row ? [row] : [],
    [DATABASE_TABLES.PAYMENT_INTENTS]: extra.intents ?? [],
    [DATABASE_TABLES.ORDERS]: extra.orders ?? [],
  });
  (getAdminClient as Mock).mockReturnValue(admin.client);
  return { user, admin };
}

beforeEach(() => {
  vi.clearAllMocks();
  reconcilePaymentIntent.mockImplementation(async (pi: { status: string }) => ({
    status: pi.status,
    paid_at: null,
  }));
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
    // The work is done and nobody was paid: the customer must still be able to.
    [STATUS.BOOKINGS.COMPLETED, true],
    [STATUS.BOOKINGS.REJECTED, false],
    [STATUS.BOOKINGS.CANCELLED, false],
    [STATUS.BOOKINGS.NO_SHOW, false],
  ])('%s → %s', (status, payable) => {
    expect(isBookingPayable(booking({ status }))).toBe(payable);
  });

  it('is not payable once paid, or when it has no price', () => {
    expect(isBookingPayable(booking({ total_paid_btc: 0.0173 }))).toBe(false);
    expect(isBookingPayable(booking({ price_btc: 0 }))).toBe(false);
    expect(
      isBookingPayable(booking({ status: STATUS.BOOKINGS.COMPLETED, total_paid_btc: 0.0173 }))
    ).toBe(false);
  });

  it('owes what is left, and nothing for a rounding remainder', () => {
    expect(bookingAmountDueBtc({ price_btc: 0.0173, total_paid_btc: 0.0073 })).toBe(0.01);
    expect(bookingAmountDueBtc({ price_btc: '0.0173', total_paid_btc: 0.017299999 })).toBe(0);
  });
});

const openOrder = (over: Record<string, unknown> = {}) => ({
  id: 'o-open',
  payment_intent_id: 'pi-open',
  booking_id: BOOKING_ID,
  buyer_id: CUSTOMER,
  seller_id: 'provider-1',
  amount_btc: 0.0173,
  entity_title: 'Custom Portrait Painting',
  status: STATUS.ORDERS.PENDING_PAYMENT,
  ...over,
});
const openIntent = (over: Record<string, unknown> = {}) => ({
  id: 'pi-open',
  status: STATUS.PAYMENT_INTENTS.INVOICE_READY,
  payment_method: 'nwc',
  amount_btc: 0.0173,
  bolt11: 'lnbc-open',
  onchain_address: null,
  description: 'Service: Custom Portrait Painting',
  expires_at: new Date(Date.now() + 3_000_000).toISOString(),
  ...over,
});
const pay = (user: ReturnType<typeof world>['user']) =>
  initiateBookingPayment(user.client, CUSTOMER, BOOKING_ID);

describe('the customer pays an accepted booking', () => {
  it('invoices the booking price to the provider and ties the order to the booking', async () => {
    const { user, admin } = world();
    const result = await pay(user);

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

  it('charges the server’s price, whatever the customer’s own copy of the row says', async () => {
    // Before migration 20261114104100 a customer could write these columns
    // through PostgREST. Their session's row is only the access check.
    const { user, admin } = world(booking(), {
      seen: booking({ price_btc: 0.00000001, total_paid_btc: 0 }),
    });
    await pay(user);
    expect(generateInvoice).toHaveBeenCalledWith(expect.anything(), 0.0173, expect.any(String));
    expect(admin.inserts[0].values).toMatchObject({ amount_btc: 0.0173 });
  });

  it('is not fooled by a "paid" the customer wrote on the booking', async () => {
    // total_paid_btc is a display value; what is paid is the paid orders.
    const { user } = world(booking({ total_paid_btc: 0.0173 }));
    await pay(user);
    expect(generateInvoice).toHaveBeenCalledWith(expect.anything(), 0.0173, expect.any(String));
  });

  it('asks only for what the paid orders leave owing', async () => {
    const { user } = world(booking(), {
      orders: [
        openOrder({
          id: 'o-paid',
          payment_intent_id: 'pi-paid',
          amount_btc: 0.0073,
          status: 'paid',
        }),
      ],
    });
    await pay(user);
    expect(generateInvoice).toHaveBeenCalledWith(expect.anything(), 0.01, expect.any(String));
  });

  it.each([
    ['is still waiting for the provider', { status: STATUS.BOOKINGS.PENDING }, {}, 409],
    ['was declined', { status: STATUS.BOOKINGS.REJECTED }, {}, 409],
    ['was cancelled', { status: STATUS.BOOKINGS.CANCELLED }, {}, 409],
    [
      'is already paid',
      {},
      { orders: [openOrder({ id: 'o-paid', payment_intent_id: 'pi-paid', status: 'paid' })] },
      409,
    ],
    ['belongs to someone else', {}, { seen: booking({ customer_user_id: 'other' }) }, 403],
  ])('refuses a booking that %s', async (_label, over, extra, status) => {
    const { user, admin } = world(booking(over), extra);
    await expect(pay(user)).rejects.toMatchObject({ status });
    expect(generateInvoice).not.toHaveBeenCalled();
    expect(admin.inserts).toEqual([]);
  });

  it('can still be paid after the provider marked it complete', async () => {
    const { user } = world(booking({ status: STATUS.BOOKINGS.COMPLETED }));
    await expect(pay(user)).resolves.toMatchObject({ qr_data: 'LNBC1' });
  });

  it('refuses a booking the customer cannot see', async () => {
    const { user } = world(booking(), { seen: null });
    await expect(pay(user)).rejects.toMatchObject({ status: 404 });
  });

  it('says so when the provider has no wallet', async () => {
    resolveSellerWallet.mockResolvedValue(null);
    const { user, admin } = world();
    const error = await pay(user).catch(e => e);
    expect(error).toBeInstanceOf(BookingPaymentError);
    expect(error.message).toMatch(/wallet/);
    expect(admin.inserts).toEqual([]);
  });
});

describe('one booking has one live invoice', () => {
  it('hands back the open request instead of minting a second', async () => {
    const { user, admin } = world(booking(), { orders: [openOrder()], intents: [openIntent()] });
    const result = await pay(user);
    expect(result.payment_intent.id).toBe('pi-open');
    expect(result.qr_data).toBe('LNBC-OPEN');
    expect(generateInvoice).not.toHaveBeenCalled();
    expect(admin.inserts).toEqual([]);
  });

  it('shows an open on-chain request again as it was minted', async () => {
    const { user } = world(booking(), {
      orders: [openOrder()],
      intents: [
        openIntent({
          payment_method: 'onchain',
          bolt11: null,
          onchain_address: 'bc1qxyz',
          expires_at: null,
        }),
      ],
    });
    const result = await pay(user);
    expect(result.qr_data).toBe(
      'bitcoin:bc1qxyz?amount=0.01730000&label=Service%3A+Custom+Portrait+Painting'
    );
    expect(generateInvoice).not.toHaveBeenCalled();
  });

  it('asks the rail first: a request paid a moment ago settles, and nothing more is asked', async () => {
    const { user, admin } = world(booking(), { orders: [openOrder()], intents: [openIntent()] });
    reconcilePaymentIntent.mockImplementation(async () => {
      // What settlement does when the rail says paid.
      admin.tables[DATABASE_TABLES.ORDERS][0].status = STATUS.ORDERS.PAID;
      return { status: STATUS.PAYMENT_INTENTS.PAID, paid_at: 'now' };
    });
    await expect(pay(user)).rejects.toMatchObject({
      status: 409,
      message: 'This booking has nothing left to pay',
    });
    expect(generateInvoice).not.toHaveBeenCalled();
  });

  it.each([
    [STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED, /You said you paid/],
    [STATUS.PAYMENT_INTENTS.PENDING_CONFIRMATION, /being confirmed/],
  ])('mints nothing while a payment is %s', async (status, message) => {
    const { user, admin } = world(booking(), {
      orders: [openOrder()],
      intents: [openIntent({ status })],
    });
    await expect(pay(user)).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(message),
    });
    expect(generateInvoice).not.toHaveBeenCalled();
    expect(admin.inserts).toEqual([]);
  });

  it('makes a new one only when the old code can no longer be paid', async () => {
    const { user } = world(booking(), {
      orders: [openOrder()],
      intents: [openIntent({ expires_at: new Date(Date.now() - 60_000).toISOString() })],
    });
    const result = await pay(user);
    expect(generateInvoice).toHaveBeenCalledTimes(1);
    expect(result.qr_data).toBe('LNBC1');
  });

  it('does not mint on a guess when the rail cannot be asked', async () => {
    reconcilePaymentIntent.mockRejectedValue(new Error('relay down'));
    const { user } = world(booking(), { orders: [openOrder()], intents: [openIntent()] });
    const result = await pay(user);
    expect(result.payment_intent.id).toBe('pi-open');
    expect(generateInvoice).not.toHaveBeenCalled();
  });
});

describe('settlement marks the order and its booking paid', () => {
  const settled = (orders: Record<string, unknown>[], bookingOver: Record<string, unknown> = {}) =>
    createFakeSupabase({
      [DATABASE_TABLES.ORDERS]: orders,
      [DATABASE_TABLES.BOOKINGS]: [booking(bookingOver)],
    });
  const dispatch = NotificationDispatcher.dispatch as Mock;

  it('records on the booking the sum of its paid orders', async () => {
    const admin = settled([
      openOrder({ id: 'o-earlier', payment_intent_id: 'pi-0', amount_btc: 0.0073, status: 'paid' }),
      openOrder({ id: 'o1', payment_intent_id: 'pi-1', amount_btc: 0.01 }),
    ]);
    await settleOrderOfPayment(admin.client, { id: 'pi-1', amount_btc: 0.01 });
    expect(admin.tables[DATABASE_TABLES.ORDERS][1].status).toBe(STATUS.ORDERS.PAID);
    expect(admin.tables[DATABASE_TABLES.BOOKINGS][0].total_paid_btc).toBe(0.0173);
  });

  it('is the same however often it runs, and whatever the column held', async () => {
    // Recomputed from the orders, never added to the column: no lost update.
    const admin = settled([openOrder({ id: 'o1', payment_intent_id: 'pi-1' })], {
      total_paid_btc: 99,
    });
    await settleOrderOfPayment(admin.client, { id: 'pi-1', amount_btc: 0.0173 });
    await settleOrderOfPayment(admin.client, { id: 'pi-1', amount_btc: 0.0173 });
    expect(admin.tables[DATABASE_TABLES.BOOKINGS][0].total_paid_btc).toBe(0.0173);
    expect(await bookingPaidBtc(admin.client, BOOKING_ID)).toBe(0.0173);
  });

  it('marks an ordinary order paid and touches no booking', async () => {
    const admin = settled([openOrder({ id: 'o1', payment_intent_id: 'pi-1', booking_id: null })]);
    await settleOrderOfPayment(admin.client, { id: 'pi-1', amount_btc: 0.0002 });
    expect(admin.tables[DATABASE_TABLES.ORDERS][0].status).toBe(STATUS.ORDERS.PAID);
    expect(admin.updates.map(u => u.table)).toEqual([DATABASE_TABLES.ORDERS]);
  });

  it('never moves an order back from a later state', async () => {
    const admin = settled([openOrder({ id: 'o1', payment_intent_id: 'pi-1', status: 'shipped' })]);
    await settleOrderOfPayment(admin.client, { id: 'pi-1', amount_btc: 0.0173 });
    expect(admin.tables[DATABASE_TABLES.ORDERS][0].status).toBe('shipped');
    expect(admin.tables[DATABASE_TABLES.BOOKINGS][0].total_paid_btc).toBe(0);
  });

  it.each([STATUS.BOOKINGS.CANCELLED, STATUS.BOOKINGS.REJECTED, STATUS.BOOKINGS.NO_SHOW])(
    'a payment that lands on a %s booking is recorded, not applied, and both sides are told',
    async status => {
      const admin = settled([openOrder({ id: 'o1', payment_intent_id: 'pi-1' })], { status });
      await settleOrderOfPayment(admin.client, { id: 'pi-1', amount_btc: 0.0173 });
      // The money did arrive: the order says so.
      expect(admin.tables[DATABASE_TABLES.ORDERS][0].status).toBe(STATUS.ORDERS.PAID);
      // The booking is off: it does not read "paid".
      expect(admin.tables[DATABASE_TABLES.BOOKINGS][0].total_paid_btc).toBe(0);
      expect(dispatch.mock.calls.map(c => c[0].userId).sort()).toEqual([CUSTOMER, 'provider-1']);
      for (const [note] of dispatch.mock.calls) {
        expect(note.message).toMatch(/OrangeCat never held it/);
      }
    }
  );

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
