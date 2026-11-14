/**
 * When a booking is paid — pure, so the booking's page and the server agree.
 *
 * A service is booked first and paid once the provider accepts: the payment
 * is asked for on an accepted booking, for what is still owed.
 *
 * `total_paid_btc` here is whatever the caller holds. The page passes the
 * booking's own column (a display value settlement keeps); the server passes
 * the sum of the booking's paid orders, which is the record it trusts.
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

/**
 * A booking can be paid once the provider accepted it, until it is paid —
 * including after the work is done: a provider who marks an unpaid booking
 * complete has not been paid, and the customer must still be able to.
 */
export function isBookingPayable(booking: BookingMoney & { status: string }): boolean {
  return (
    (booking.status === STATUS.BOOKINGS.CONFIRMED ||
      booking.status === STATUS.BOOKINGS.IN_PROGRESS ||
      booking.status === STATUS.BOOKINGS.COMPLETED) &&
    bookingAmountDueBtc(booking) > 0
  );
}

/** A booking that ended without the work: a payment for it is not a payment of it. */
export function isBookingCalledOff(status: string): boolean {
  return (
    status === STATUS.BOOKINGS.CANCELLED ||
    status === STATUS.BOOKINGS.REJECTED ||
    status === STATUS.BOOKINGS.NO_SHOW
  );
}
