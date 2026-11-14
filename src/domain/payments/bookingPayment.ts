/**
 * Paying a booking the provider accepted.
 *
 * A service is booked first and paid on acceptance. The booking's page used to
 * show the provider's bare address and the amount to type by hand, and nothing
 * ever told the booking it was paid. This mints a real invoice on the
 * provider's own wallet for the price the booking recorded, with an order tied
 * to the booking (orders.booking_id), so settlement marks both the order and
 * the booking paid. No escrow: the money goes straight to the provider, and
 * OrangeCat never holds it.
 *
 * Who is paid and what is charged are what the booking page already asked for:
 * the wallet resolved for the booked listing, and the booking's own price_btc.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { getAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/utils/logger';
import { bookingAmountDueBtc, isBookingPayable } from '@/domain/bookings/payment';
import { resolveSellerWallet, getSellerUserId } from './walletResolutionService';
import { generateInvoice } from './invoiceGenerationService';
import { resolveIntentExpiry, expiresInSecondsFrom } from './intentExpiry';
import { METHOD_LABELS, getEntityTitle } from './paymentFlowHelpers';
import type { InitiatePaymentResult, PaymentIntent } from './types';

export class BookingPaymentError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409
  ) {
    super(message);
    this.name = 'BookingPaymentError';
  }
}

interface BookingRow {
  id: string;
  bookable_type: string;
  bookable_id: string;
  customer_user_id: string;
  status: string;
  price_btc: number | string | null;
  total_paid_btc: number | string | null;
}

/**
 * Start the customer's payment of an accepted booking. `supabase` is the
 * customer's own session: its RLS read of the booking is the access check.
 */
export async function initiateBookingPayment(
  supabase: SupabaseClient,
  customerUserId: string,
  bookingId: string
): Promise<InitiatePaymentResult> {
  const { data } = await supabase
    .from(DATABASE_TABLES.BOOKINGS)
    .select('id, bookable_type, bookable_id, customer_user_id, status, price_btc, total_paid_btc')
    .eq('id', bookingId)
    .maybeSingle();
  const booking = data as BookingRow | null;
  if (!booking) {
    throw new BookingPaymentError('Booking not found', 404);
  }
  if (booking.customer_user_id !== customerUserId) {
    throw new BookingPaymentError('Only the customer pays a booking', 403);
  }
  if (booking.status === STATUS.BOOKINGS.PENDING) {
    throw new BookingPaymentError('This booking is paid once the provider accepts it', 409);
  }
  if (!isBookingPayable(booking)) {
    throw new BookingPaymentError('This booking has nothing left to pay', 409);
  }

  const entityType = booking.bookable_type as EntityType;
  const entityId = booking.bookable_id;
  const meta = getEntityMetadata(entityType);
  const sellerId = await getSellerUserId(supabase, entityType, entityId);
  const wallet = sellerId ? await resolveSellerWallet(entityType, entityId) : null;
  if (!sellerId || !wallet) {
    throw new BookingPaymentError(
      'The provider has not connected a wallet yet, so this booking cannot be paid here.',
      409
    );
  }

  const amountBtc = bookingAmountDueBtc(booking);
  const title = await getEntityTitle(supabase, entityType, entityId);
  const description = `${meta.name}: ${title}`;
  const invoice = await generateInvoice(wallet, amountBtc, description);
  const admin = getAdminClient() as unknown as SupabaseClient;

  const { data: paymentIntent, error: intentError } = await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .insert({
      buyer_id: customerUserId,
      seller_id: sellerId,
      entity_type: entityType,
      entity_id: entityId,
      amount_btc: amountBtc,
      payment_method: invoice.method, // the rail that minted it — see GeneratedInvoice
      intent_kind: 'purchase',
      receiving_wallet_id: wallet.wallet_id,
      bolt11: invoice.bolt11,
      payment_hash: invoice.payment_hash,
      onchain_address: invoice.onchain_address,
      lnurl_verify_url: invoice.lnurl_verify_url,
      status:
        invoice.bolt11 || invoice.onchain_address
          ? STATUS.PAYMENT_INTENTS.INVOICE_READY
          : STATUS.PAYMENT_INTENTS.CREATED,
      description,
      expires_at: resolveIntentExpiry(invoice.method, invoice.expires_at),
    })
    .select()
    .single();
  if (intentError || !paymentIntent) {
    logger.error('Failed to create booking payment intent', { bookingId, error: intentError });
    throw new Error('Failed to create payment intent');
  }

  const { data: order, error: orderError } = await admin
    .from(DATABASE_TABLES.ORDERS)
    .insert({
      payment_intent_id: paymentIntent.id,
      booking_id: booking.id,
      buyer_id: customerUserId,
      seller_id: sellerId,
      entity_type: entityType,
      entity_id: entityId,
      amount_btc: amountBtc,
      entity_title: title,
      status: STATUS.ORDERS.PENDING_PAYMENT,
    })
    .select()
    .single();
  if (orderError || !order) {
    // Without the order nothing would tell the booking it was paid.
    await admin.from(DATABASE_TABLES.PAYMENT_INTENTS).delete().eq('id', paymentIntent.id);
    logger.error('Failed to create booking order', { bookingId, error: orderError });
    throw new Error('Failed to create order');
  }

  return {
    payment_intent: paymentIntent,
    order,
    qr_data: invoice.qr_data,
    method_label: METHOD_LABELS[invoice.method] || invoice.method,
    expires_in_seconds: expiresInSecondsFrom(paymentIntent.expires_at),
  };
}

/**
 * Settlement's half: the order of a paid intent, and the booking it pays.
 *
 * Runs for every settled purchase. It marks the intent's order paid — also
 * for a listing whose registry pattern is not fixed_price (an asset rental is
 * booked and paid, never bought) — and, when the order pays a booking, records
 * the amount on the booking. Never throws: the money has already moved.
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
      .select('id, booking_id');
    if (error) {
      logger.error('Order status update failed after confirmed payment — needs reconciliation', {
        paymentIntentId: paymentIntent.id,
        error,
      });
      return;
    }

    for (const order of (data ?? []) as Array<{ id: string; booking_id: string | null }>) {
      if (!order.booking_id) {
        continue;
      }
      const { data: booking } = await admin
        .from(DATABASE_TABLES.BOOKINGS)
        .select('total_paid_btc')
        .eq('id', order.booking_id)
        .maybeSingle();
      const paid = Number(booking?.total_paid_btc ?? 0) + Number(paymentIntent.amount_btc);
      const { error: bookingError } = await admin
        .from(DATABASE_TABLES.BOOKINGS)
        .update({ total_paid_btc: Number(paid.toFixed(8)) })
        .eq('id', order.booking_id);
      if (bookingError) {
        logger.error('Booking not marked paid after confirmed payment — needs reconciliation', {
          paymentIntentId: paymentIntent.id,
          bookingId: order.booking_id,
          error: bookingError,
        });
      }
    }
  } catch (error) {
    logger.error('Order settlement failed after confirmed payment — needs reconciliation', {
      paymentIntentId: paymentIntent.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
