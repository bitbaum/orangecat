/**
 * A paid event ticket without an account.
 *
 * The same account-free rail as public support: a Bitcoin invoice on the
 * organizer's own wallet, a payment intent with no buyer, and a bearer status
 * token the guest polls with. What differs is what settlement hands out — the
 * intent carries the name the guest gave, and {@link handlePaymentConfirmed}
 * issues the ticket to that name. The guest's ticket is then its own page,
 * exactly like a free guest ticket.
 *
 * No order row: an order needs a buyer account, and the ticket row
 * (event_attendees.transaction_id = this intent) is the record of the sale.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { getEntityMetadata } from '@/config/entity-registry';
import { getAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/utils/logger';
import { GUEST_NAME_MAX, getSeatsLeft } from '@/domain/events/tickets';
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

export interface GuestTicketPurchaseInput {
  eventId: string;
  /** The name on the ticket — what the door list shows. */
  name: string;
}

export class GuestTicketPurchaseError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 503
  ) {
    super(message);
    this.name = 'GuestTicketPurchaseError';
  }
}

/**
 * Start a guest's ticket purchase. `publicSupabase` must be sessionless: its
 * anonymous read is the publication gate, as in initiatePublicSupport.
 */
export async function initiateGuestTicketPurchase(
  publicSupabase: SupabaseClient,
  input: GuestTicketPurchaseInput
): Promise<InitiatePublicSupportResult> {
  const entityType = 'event' as const;
  const { eventId } = input;
  const name = input.name.trim();
  if (!name || name.length > GUEST_NAME_MAX) {
    throw new GuestTicketPurchaseError(
      `Tell the host your name (up to ${GUEST_NAME_MAX} characters)`,
      400
    );
  }

  const meta = getEntityMetadata(entityType);
  const { data: visible } = await publicSupabase
    .from(meta.tableName)
    .select('id')
    .eq('id', eventId)
    .maybeSingle();
  if (!visible) {
    throw new GuestTicketPurchaseError('Event not found', 404);
  }

  // Capacity holds only here: once money moves, the ticket is always issued.
  if ((await getSeatsLeft(publicSupabase, eventId)) === 0) {
    throw new GuestTicketPurchaseError('This event is sold out', 409);
  }

  let amountBtc: number;
  try {
    amountBtc = await resolveAmount(publicSupabase, entityType, eventId);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Entity has no price set') {
      throw new GuestTicketPurchaseError('This event is free: get a ticket with your name', 409);
    }
    throw new GuestTicketPurchaseError(
      'Bitcoin prices are unavailable right now. Try again in a minute.',
      503
    );
  }

  const sellerId = await getSellerUserId(publicSupabase, entityType, eventId);
  const wallet = sellerId ? await resolveSellerWallet(entityType, eventId) : null;
  if (!sellerId || !wallet) {
    throw new GuestTicketPurchaseError(
      'The organizer has not connected a wallet yet, so tickets cannot be paid for online.',
      409
    );
  }

  const title = await getEntityTitle(publicSupabase, entityType, eventId);
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
      entity_id: eventId,
      amount_btc: amountBtc,
      payment_method: invoice.method,
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
    logger.error('Failed to create guest ticket payment intent', { eventId, error });
    throw new Error('Failed to create guest ticket payment intent');
  }

  return {
    payment_intent: {
      id: intent.id,
      amount_btc: Number(intent.amount_btc),
      payment_method: intent.payment_method,
      status: intent.status,
      expires_at: intent.expires_at,
      // A bare Lightning address cannot prove payment; the guest says they
      // paid and the organizer confirms it, as with public support.
      can_acknowledge: intent.payment_method === 'lightning_address' && !intent.lnurl_verify_url,
    },
    status_token: token,
    qr_data: invoice.qr_data,
    method_label: METHOD_LABELS[invoice.method] || invoice.method,
    expires_in_seconds: expiresInSecondsFrom(expiresAt),
  };
}
