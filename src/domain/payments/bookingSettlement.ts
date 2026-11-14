/**
 * What a booking has been paid, and settlement's half of paying one.
 *
 * The record of a booking's payment is its ORDERS (orders.booking_id), which
 * only the server writes. `bookings.total_paid_btc` is a display value kept
 * from them: it is recomputed from the paid orders each time one settles, so
 * it is never a read-then-add that two settlements could race.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { ROUTES } from '@/config/routes';
import { logger } from '@/utils/logger';
import { isBookingCalledOff } from '@/domain/bookings/payment';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import type { PaymentIntent } from './types';

/** Order states in which the money has arrived (and not gone back). */
const PAID_ORDER_STATUSES = [STATUS.ORDERS.PAID, STATUS.ORDERS.SHIPPED, STATUS.ORDERS.COMPLETED];

/** The sum of a booking's paid orders, in BTC. */
export async function bookingPaidBtc(admin: SupabaseClient, bookingId: string): Promise<number> {
  const { data, error } = await admin
    .from(DATABASE_TABLES.ORDERS)
    .select('amount_btc')
    .eq('booking_id', bookingId)
    .in('status', PAID_ORDER_STATUSES);
  if (error) {
    throw new Error('Could not read what this booking has been paid');
  }
  const sum = ((data ?? []) as Array<{ amount_btc: number | string }>).reduce(
    (total, row) => total + Number(row.amount_btc),
    0
  );
  return Number(sum.toFixed(8));
}

interface SettledOrder {
  id: string;
  booking_id: string | null;
  buyer_id: string | null;
  seller_id: string;
  entity_title: string | null;
}

/**
 * Settlement's half: the order of a paid intent, and the booking it pays.
 *
 * Runs for every settled purchase. It marks the intent's order paid — also
 * for a listing whose registry pattern is not fixed_price (an asset rental is
 * booked and paid, never bought) — and, when the order pays a booking, brings
 * the booking's paid amount up to date.
 *
 * A booking that was cancelled, declined or a no-show after its invoice was
 * made can still receive the payment: the invoice lives in the provider's
 * wallet and cannot be recalled. Then the order IS marked paid (the money did
 * arrive) but the booking is NOT marked paid, and both sides are told, so the
 * return is arranged between them. OrangeCat never held the money and cannot
 * send it back.
 *
 * Never throws: the money has already moved.
 */
export async function settleOrderOfPayment(
  admin: SupabaseClient,
  paymentIntent: Pick<PaymentIntent, 'id' | 'amount_btc'>
): Promise<void> {
  try {
    const { data, error } = await admin
      .from(DATABASE_TABLES.ORDERS)
      .update({ status: STATUS.ORDERS.PAID })
      .eq('payment_intent_id', paymentIntent.id)
      .eq('status', STATUS.ORDERS.PENDING_PAYMENT)
      .select('id, booking_id, buyer_id, seller_id, entity_title');
    if (error) {
      logger.error('Order status update failed after confirmed payment — needs reconciliation', {
        paymentIntentId: paymentIntent.id,
        error,
      });
      return;
    }

    for (const order of (data ?? []) as SettledOrder[]) {
      if (order.booking_id) {
        await settleBookingOrder(admin, order, paymentIntent);
      }
    }
  } catch (error) {
    logger.error('Order settlement failed after confirmed payment — needs reconciliation', {
      paymentIntentId: paymentIntent.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function settleBookingOrder(
  admin: SupabaseClient,
  order: SettledOrder,
  paymentIntent: Pick<PaymentIntent, 'id' | 'amount_btc'>
): Promise<void> {
  const bookingId = order.booking_id as string;
  const { data: booking } = await admin
    .from(DATABASE_TABLES.BOOKINGS)
    .select('status')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking || isBookingCalledOff(String(booking.status))) {
    logger.warn('Payment settled for a booking that was called off', {
      paymentIntentId: paymentIntent.id,
      bookingId,
      status: booking?.status ?? null,
    });
    notifyPaidAfterCalledOff(order, paymentIntent, bookingId);
    return;
  }

  // Recomputed from the paid orders, never added to what was there: two
  // settlements cannot lose each other's amount, and a repeat changes nothing.
  const paid = await bookingPaidBtc(admin, bookingId);
  const { error } = await admin
    .from(DATABASE_TABLES.BOOKINGS)
    .update({ total_paid_btc: paid })
    .eq('id', bookingId);
  if (error) {
    logger.error('Booking not marked paid after confirmed payment — needs reconciliation', {
      paymentIntentId: paymentIntent.id,
      bookingId,
      error,
    });
  }
}

/** Both sides learn that money moved for a booking that is off. Fire-and-forget. */
function notifyPaidAfterCalledOff(
  order: SettledOrder,
  paymentIntent: Pick<PaymentIntent, 'id' | 'amount_btc'>,
  bookingId: string
): void {
  const what = order.entity_title?.trim() || 'a booking';
  const amount = `${paymentIntent.amount_btc} BTC`;
  const data = { paymentIntentId: paymentIntent.id, bookingId, kind: 'paid_after_called_off' };
  const actionUrl = ROUTES.DASHBOARD.BOOKINGS_VIEW(bookingId);
  void NotificationDispatcher.dispatch({
    userId: order.seller_id,
    type: 'payment',
    title: 'A payment arrived for a booking that is off',
    message: `${amount} reached your wallet for ${what}, but that booking was cancelled or declined. Send it back to the customer, or agree with them what happens. OrangeCat never held it.`,
    data,
    actionUrl,
  });
  if (order.buyer_id) {
    void NotificationDispatcher.dispatch({
      userId: order.buyer_id,
      type: 'payment',
      title: 'Your payment went through, but the booking is off',
      message: `${amount} reached the provider's wallet for ${what} after the booking was cancelled or declined. Ask them to send it back. OrangeCat never held it and cannot return it.`,
      data,
      actionUrl,
    });
  }
}
