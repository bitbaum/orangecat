/**
 * A purchase without an account, as a real order.
 *
 * A signed-out buyer used to be shown the seller's bare address and told to
 * type the price into their wallet: nothing recorded the sale, so the seller
 * had no order and the buyer no receipt. This is the same account-free rail as
 * public support and a guest's ticket — a Bitcoin invoice on the seller's own
 * wallet for the listing's price, a payment intent with no buyer, a bearer
 * status token — plus the order row a signed-in purchase has always written.
 * Settlement ({@link handlePaymentConfirmed}) marks that order paid, so the
 * seller sees it and is told who bought and how to reach them.
 *
 * Who is paid and what is charged are exactly the signed-in purchase's:
 * resolveSellerWallet and resolveAmount, read on the server.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { isBookedBeforePaid } from '@/config/payment-flow';
import { GUEST_ORDER_NOTE_MAX } from '@/config/orders';
import { getAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/utils/logger';
import { GUEST_NAME_MAX } from '@/domain/events/tickets';
import { resolveSellerWallet, getSellerUserId } from './walletResolutionService';
import { generateInvoice } from './invoiceGenerationService';
import { resolveIntentExpiry, expiresInSecondsFrom } from './intentExpiry';
import {
  METHOD_LABELS,
  hashPublicStatusToken,
  resolveAmount,
  getEntityTitle,
} from './paymentFlowHelpers';
import type { InitiatePublicSupportResult } from './types';

export interface GuestPurchaseInput {
  entityType: EntityType;
  entityId: string;
  /** Who the seller is dealing with. */
  name: string;
  /** How to reach the buyer, or where to send it. Only the seller reads it. */
  note?: string | null;
}

export class GuestPurchaseError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 503
  ) {
    super(message);
    this.name = 'GuestPurchaseError';
  }
}

/**
 * Start a purchase for a buyer with no account. `publicSupabase` must be
 * sessionless: its anonymous read is the publication gate, as in
 * initiatePublicSupport.
 */
export async function initiateGuestPurchase(
  publicSupabase: SupabaseClient,
  input: GuestPurchaseInput
): Promise<InitiatePublicSupportResult> {
  const { entityType, entityId } = input;
  const meta = getEntityMetadata(entityType);
  // A ticket has its own guest path (it issues the ticket); a service is
  // booked first and paid once the provider accepts.
  if (
    meta.paymentPattern !== 'fixed_price' ||
    entityType === 'event' ||
    isBookedBeforePaid(entityType)
  ) {
    throw new GuestPurchaseError('This cannot be bought here', 400);
  }

  const name = input.name.trim();
  if (!name || name.length > GUEST_NAME_MAX) {
    throw new GuestPurchaseError(
      `Tell the seller your name (up to ${GUEST_NAME_MAX} characters)`,
      400
    );
  }
  const note = input.note?.trim() || null;
  if (note && note.length > GUEST_ORDER_NOTE_MAX) {
    throw new GuestPurchaseError(`Keep the note under ${GUEST_ORDER_NOTE_MAX} characters`, 400);
  }

  const { data: visible } = await publicSupabase
    .from(meta.tableName)
    .select('id')
    .eq('id', entityId)
    .maybeSingle();
  if (!visible) {
    throw new GuestPurchaseError(`${meta.name} not found`, 404);
  }

  let amountBtc: number;
  try {
    amountBtc = await resolveAmount(publicSupabase, entityType, entityId);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Entity has no price set') {
      throw new GuestPurchaseError('This has no price yet, so it cannot be bought online.', 409);
    }
    throw new GuestPurchaseError(
      'Bitcoin prices are unavailable right now. Try again in a minute.',
      503
    );
  }

  const sellerId = await getSellerUserId(publicSupabase, entityType, entityId);
  const wallet = sellerId ? await resolveSellerWallet(entityType, entityId) : null;
  if (!sellerId || !wallet) {
    throw new GuestPurchaseError(
      'The seller has not connected a wallet yet, so this cannot be paid for online.',
      409
    );
  }

  const title = await getEntityTitle(publicSupabase, entityType, entityId);
  const description = `${meta.name}: ${title}`;
  const invoice = await generateInvoice(wallet, amountBtc, description);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = resolveIntentExpiry(invoice.method, invoice.expires_at);
  const admin = getAdminClient() as unknown as SupabaseClient;

  const { data: intent, error } = await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .insert({
      buyer_id: null,
      guest_name: name,
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
      expires_at: expiresAt,
      public_status_token_hash: hashPublicStatusToken(token),
    })
    .select()
    .single();

  if (error || !intent) {
    logger.error('Failed to create guest purchase payment intent', { entityId, error });
    throw new Error('Failed to create guest purchase payment intent');
  }

  // The order is the point. An invoice with no order behind it is the bare
  // address again, so if the order cannot be written the invoice is withdrawn
  // rather than handed out.
  const { error: orderError } = await admin.from(DATABASE_TABLES.ORDERS).insert({
    payment_intent_id: intent.id,
    buyer_id: null,
    seller_id: sellerId,
    entity_type: entityType,
    entity_id: entityId,
    amount_btc: amountBtc,
    entity_title: title,
    status: STATUS.ORDERS.PENDING_PAYMENT,
    buyer_note: note,
  });
  if (orderError) {
    await admin.from(DATABASE_TABLES.PAYMENT_INTENTS).delete().eq('id', intent.id);
    logger.error('Failed to create guest order', { entityId, error: orderError });
    throw new Error('Failed to create guest order');
  }

  return {
    payment_intent: {
      id: intent.id,
      amount_btc: Number(intent.amount_btc),
      payment_method: intent.payment_method,
      status: intent.status,
      expires_at: intent.expires_at,
      // A bare Lightning address cannot prove payment; the buyer says they
      // paid and the seller confirms it, as with public support.
      can_acknowledge: intent.payment_method === 'lightning_address' && !intent.lnurl_verify_url,
    },
    status_token: token,
    qr_data: invoice.qr_data,
    method_label: METHOD_LABELS[invoice.method] || invoice.method,
    expires_in_seconds: expiresInSecondsFrom(expiresAt),
  };
}
