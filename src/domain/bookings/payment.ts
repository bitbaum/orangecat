/**
 * When a booking is paid — pure, so the booking's page and the server agree.
 *
 * A service is booked first and paid once the provider accepts: the payment
 * is asked for on a confirmed (or started) booking, for what is still owed.
 */

import { STATUS } from '@/config/database-constants';

/** Half a satoshi: an amount that rounds to the price is the price. */
const PAID_TOLERANCE_BTC = 0.5e-8;

interface BookingMoney {
  price_btc: number | string | null;
  total_paid_btc?: number | string | null;
}

/** What is still owed on a booking, in BTC; 0 once it is paid. */
export function bookingAmountDueBtc(booking: BookingMoney): number {
  const due = Number(booking.price_btc ?? 0) - Number(booking.total_paid_btc ?? 0);
  return due > PAID_TOLERANCE_BTC ? Number(due.toFixed(8)) : 0;
}

/** A booking can be paid once the provider accepted it, until it is paid. */
export function isBookingPayable(booking: BookingMoney & { status: string }): boolean {
  return (
    (booking.status === STATUS.BOOKINGS.CONFIRMED ||
      booking.status === STATUS.BOOKINGS.IN_PROGRESS) &&
    bookingAmountDueBtc(booking) > 0
  );
}
