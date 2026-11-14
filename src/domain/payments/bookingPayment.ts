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
 *
 * What is trusted. The customer's own session only proves they may see the
 * booking. The price is then read with the service role (a booking's money
 * columns are server-written: migration 20261114104100), and what has been
 * paid is the sum of the booking's paid orders — never `total_paid_btc`,
 * which is a display value.
 *
 * One live invoice. Asking again returns the request that is already open
 * rather than minting another: two payable invoices for one booking is how a
 * booking gets paid twice. An open request is first checked against its rail,
 * so one that was paid meanwhile settles instead of being offered again.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { getAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/utils/logger';
import {
  bookingAmountDueBtc,
  isBookingCalledOff,
  isBookingPayable,
} from '@/domain/bookings/payment';
import { resolveSellerWallet, getSellerUserId } from './walletResolutionService';
import { generateInvoice, onchainPaymentUri } from './invoiceGenerationService';
import { resolveIntentExpiry, expiresInSecondsFrom } from './intentExpiry';
import { METHOD_LABELS, getEntityTitle } from './paymentFlowHelpers';
import { reconcilePaymentIntent } from './paymentStatusFlow';
import { bookingPaidBtc } from './bookingSettlement';
import type { InitiatePaymentResult, Order, PaymentIntent } from './types';

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
}

/** Intent states in which a payment may still arrive or be confirmed. */
const OPEN_INTENT_STATUSES: string[] = [
  STATUS.PAYMENT_INTENTS.CREATED,
  STATUS.PAYMENT_INTENTS.INVOICE_READY,
  STATUS.PAYMENT_INTENTS.PENDING_CONFIRMATION,
  STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED,
];

/** The code a payer is shown for an intent, exactly as it was minted. */
function qrDataOf(intent: PaymentIntent): string | null {
  if (intent.bolt11) {
    return intent.bolt11.toUpperCase();
  }
  return intent.onchain_address
    ? onchainPaymentUri(intent.onchain_address, Number(intent.amount_btc), intent.description ?? '')
    : null;
}

function asResult(intent: PaymentIntent, order: Order | undefined): InitiatePaymentResult | null {
  const qrData = qrDataOf(intent);
  return qrData
    ? {
        payment_intent: intent,
        order,
        qr_data: qrData,
        method_label: METHOD_LABELS[intent.payment_method] || intent.payment_method,
        expires_in_seconds: expiresInSecondsFrom(intent.expires_at),
      }
    : null;
}

/**
 * The booking's requests that are still open, each checked against its rail
 * first (which settles one that was paid, and expires one that is dead).
 */
async function openBookingPayments(
  admin: SupabaseClient,
  bookingId: string
): Promise<Array<{ intent: PaymentIntent; order: Order }>> {
  const { data: orders } = await admin
    .from(DATABASE_TABLES.ORDERS)
    .select('*')
    .eq('booking_id', bookingId)
    .eq('status', STATUS.ORDERS.PENDING_PAYMENT);
  const pending = (orders ?? []) as Order[];
  if (pending.length === 0) {
    return [];
  }
  const { data: intents } = await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .select('*')
    .in(
      'id',
      pending.map(o => o.payment_intent_id)
    )
    .in('status', OPEN_INTENT_STATUSES);

  const open: Array<{ intent: PaymentIntent; order: Order }> = [];
  for (const intent of (intents ?? []) as PaymentIntent[]) {
    // A rail that cannot be asked right now leaves the request as it stands:
    // still open, so no second invoice is minted on a guess.
    const { status } = await reconcilePaymentIntent(intent).catch(() => ({
      status: intent.status,
    }));
    const order = pending.find(o => o.payment_intent_id === intent.id);
    if (order && OPEN_INTENT_STATUSES.includes(status)) {
      open.push({ intent: { ...intent, status }, order });
    }
  }
  return open;
}

/**
 * Start the customer's payment of an accepted booking, or hand back the
 * request that is already open. `supabase` is the customer's own session: its
 * RLS read of the booking is the access check and nothing more.
 */
export async function initiateBookingPayment(
  supabase: SupabaseClient,
  customerUserId: string,
  bookingId: string
): Promise<InitiatePaymentResult> {
  const { data: visible } = await supabase
    .from(DATABASE_TABLES.BOOKINGS)
    .select('id, customer_user_id')
    .eq('id', bookingId)
    .maybeSingle();
  if (!visible) {
    throw new BookingPaymentError('Booking not found', 404);
  }
  if ((visible as { customer_user_id: string }).customer_user_id !== customerUserId) {
    throw new BookingPaymentError('Only the customer pays a booking', 403);
  }

  const admin = getAdminClient() as unknown as SupabaseClient;
  const { data } = await admin
    .from(DATABASE_TABLES.BOOKINGS)
    .select('id, bookable_type, bookable_id, customer_user_id, status, price_btc')
    .eq('id', bookingId)
    .maybeSingle();
  const booking = data as BookingRow | null;
  if (!booking || booking.customer_user_id !== customerUserId) {
    throw new BookingPaymentError('Booking not found', 404);
  }
  if (booking.status === STATUS.BOOKINGS.PENDING) {
    throw new BookingPaymentError('This booking is paid once the provider accepts it', 409);
  }
  if (isBookingCalledOff(booking.status)) {
    throw new BookingPaymentError('This booking is off, so there is nothing to pay', 409);
  }

  // Before reading what is paid: a request paid a moment ago settles here.
  const open = await openBookingPayments(admin, bookingId);
  const owed = { ...booking, total_paid_btc: await bookingPaidBtc(admin, bookingId) };
  if (!isBookingPayable(owed)) {
    throw new BookingPaymentError('This booking has nothing left to pay', 409);
  }
  const amountBtc = bookingAmountDueBtc(owed);

  for (const { intent, order } of open) {
    if (intent.status === STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED) {
      throw new BookingPaymentError(
        'You said you paid this booking. The provider confirms it once it shows in their wallet; you do not need to pay again.',
        409
      );
    }
    if (intent.status === STATUS.PAYMENT_INTENTS.PENDING_CONFIRMATION) {
      throw new BookingPaymentError(
        'A payment for this booking is on its way and is being confirmed. You do not need to pay again.',
        409
      );
    }
    // Still payable (a dead Lightning invoice is not: its rail check above
    // leaves it open only for the payer's late "I've paid").
    const alive = !intent.expires_at || new Date(intent.expires_at) > new Date();
    const existing =
      alive && Number(intent.amount_btc) === amountBtc ? asResult(intent, order) : null;
    if (existing) {
      return existing;
    }
  }

  const entityType = booking.bookable_type as EntityType;
  const entityId = booking.bookable_id;
  const meta = getEntityMetadata(entityType);
  const sellerId = await getSellerUserId(admin, entityType, entityId);
  const wallet = sellerId ? await resolveSellerWallet(entityType, entityId) : null;
  if (!sellerId || !wallet) {
    throw new BookingPaymentError(
      'The provider has not connected a wallet yet, so this booking cannot be paid here.',
      409
    );
  }

  const title = await getEntityTitle(admin, entityType, entityId);
  const description = `${meta.name}: ${title}`;
  const invoice = await generateInvoice(wallet, amountBtc, description);

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
