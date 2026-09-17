/**
 * Payment Flow — Initiation
 *
 * Creates payment intents + invoices for the three entry points:
 * authenticated purchase/support, account-free public support, and tips.
 * Extracted from paymentFlowService.ts (pure move).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { getEntityMetadata } from '@/config/entity-registry';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveSellerWallet, getSellerUserId } from './walletResolutionService';
import { generateInvoice } from './invoiceGenerationService';
import { resolveIntentExpiry, expiresInSecondsFrom } from './intentExpiry';
import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  InitiatePublicSupportInput,
  InitiatePublicSupportResult,
  InitiateTipInput,
} from './types';
import { logger } from '@/utils/logger';
import {
  METHOD_LABELS,
  hashPublicStatusToken,
  resolveAmount,
  getEntityTitle,
} from './paymentFlowHelpers';

/**
 * Initiate a payment flow for a buyer purchasing/supporting an entity.
 */
export async function initiatePayment(
  supabase: SupabaseClient,
  buyerId: string,
  input: InitiatePaymentInput
): Promise<InitiatePaymentResult> {
  const { entity_type, entity_id } = input;
  const meta = getEntityMetadata(entity_type);

  // 0. Publication gate — the buyer's own RLS read is the check, exactly like
  // the public-support flow. Everything after this resolves through the admin
  // client (seller lookup, wallet secrets), so without this gate an
  // authenticated user could mint an invoice + order against a DRAFT entity
  // the owner never published (found by live simulation, 2026-08-02).
  const { data: visibleEntity } = await supabase
    .from(meta.tableName)
    .select('id')
    .eq('id', entity_id)
    .maybeSingle();
  if (!visibleEntity) {
    throw new Error('Entity is not publicly available');
  }

  // 1. Resolve seller
  const sellerId = await getSellerUserId(supabase, entity_type, entity_id);
  if (!sellerId) {
    throw new Error('Entity owner not found');
  }

  if (sellerId === buyerId) {
    throw new Error('Cannot purchase your own entity');
  }

  // 2. Resolve seller's wallet & payment method
  const wallet = await resolveSellerWallet(entity_type, entity_id);
  if (!wallet) {
    throw new Error('Seller has no wallet connected. Payment not available.');
  }

  // 3. Determine amount
  const amountBtc = await resolveAmount(supabase, entity_type, entity_id, input.amount_btc);

  // 4. Determine entity title (snapshot for order)
  const entityTitle = await getEntityTitle(supabase, entity_type, entity_id);

  // 5. Generate invoice
  const description = `${meta.name}: ${entityTitle}`;
  const invoice = await generateInvoice(wallet, amountBtc, description);

  // 6. Create payment intent
  const { data: paymentIntent, error: piError } = await supabase
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      entity_type,
      entity_id,
      amount_btc: amountBtc,
      payment_method: wallet.method,
      intent_kind: meta.paymentPattern === 'fixed_price' ? 'purchase' : 'support',
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
      expires_at: resolveIntentExpiry(wallet.method, invoice.expires_at),
    })
    .select()
    .single();

  if (piError || !paymentIntent) {
    logger.error('Failed to create payment intent', { error: piError });
    throw new Error('Failed to create payment intent');
  }

  // 7. Create order or contribution depending on payment pattern
  let order;
  let contribution;

  if (meta.paymentPattern === 'fixed_price') {
    const { data, error } = await supabase
      .from(DATABASE_TABLES.ORDERS)
      .insert({
        payment_intent_id: paymentIntent.id,
        buyer_id: buyerId,
        seller_id: sellerId,
        entity_type,
        entity_id,
        amount_btc: amountBtc,
        entity_title: entityTitle,
        status: STATUS.ORDERS.PENDING_PAYMENT,
        shipping_address_id: input.shipping_address_id || null,
        buyer_note: input.buyer_note || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create order', { error });
      throw new Error('Failed to create order');
    }
    order = data;
  } else if (meta.paymentPattern === 'contribution') {
    const { data, error } = await supabase
      .from(DATABASE_TABLES.CONTRIBUTIONS)
      .insert({
        payment_intent_id: paymentIntent.id,
        contributor_id: buyerId,
        entity_type,
        entity_id,
        amount_btc: amountBtc,
        message: input.message || null,
        is_anonymous: input.is_anonymous ?? false,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create contribution', { error });
      throw new Error('Failed to create contribution');
    }
    contribution = data;
  }

  // 8. Countdown for the payer — null on rails that never expire (on-chain).
  const expiresInSeconds = expiresInSecondsFrom(paymentIntent.expires_at);

  return {
    payment_intent: paymentIntent,
    order,
    contribution,
    qr_data: invoice.qr_data,
    method_label: METHOD_LABELS[wallet.method] || wallet.method,
    expires_in_seconds: expiresInSeconds,
  };
}

/**
 * Create a tracked voluntary contribution without requiring an account.
 *
 * The caller must pass a sessionless client. Its anonymous RLS read is the
 * publication gate; all cross-user wallet and insert work happens through the
 * service-role client only after that check succeeds.
 */
export async function initiatePublicSupport(
  publicSupabase: SupabaseClient,
  input: InitiatePublicSupportInput
): Promise<InitiatePublicSupportResult> {
  const { entity_type: entityType, entity_id: entityId, amount_btc: amountBtc } = input;
  const meta = getEntityMetadata(entityType);
  if (!meta.canReceiveSupport) {
    throw new Error('This entity cannot receive public support');
  }

  const { data: visibleEntity } = await publicSupabase
    .from(meta.tableName)
    .select('id')
    .eq('id', entityId)
    .maybeSingle();
  if (!visibleEntity) {
    throw new Error('Entity is not publicly available');
  }

  const sellerId = await getSellerUserId(publicSupabase, entityType, entityId);
  if (!sellerId) {
    throw new Error('Entity owner not found');
  }

  const wallet = await resolveSellerWallet(entityType, entityId);
  if (!wallet) {
    throw new Error('Seller has no wallet connected. Payment not available.');
  }

  const entityTitle = await getEntityTitle(publicSupabase, entityType, entityId);
  const description = `Support: ${entityTitle}`;
  const invoice = await generateInvoice(wallet, amountBtc, description);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = resolveIntentExpiry(wallet.method, invoice.expires_at);
  const admin = getAdminClient() as unknown as SupabaseClient;

  const { data: paymentIntent, error: paymentError } = await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .insert({
      buyer_id: null,
      seller_id: sellerId,
      entity_type: entityType,
      entity_id: entityId,
      amount_btc: amountBtc,
      payment_method: wallet.method,
      intent_kind: 'support',
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

  if (paymentError || !paymentIntent) {
    logger.error('Failed to create public payment intent', { error: paymentError });
    throw new Error('Failed to create public payment intent');
  }

  const { error: contributionError } = await admin.from(DATABASE_TABLES.CONTRIBUTIONS).insert({
    payment_intent_id: paymentIntent.id,
    contributor_id: null,
    entity_type: entityType,
    entity_id: entityId,
    amount_btc: amountBtc,
    message: null,
    is_anonymous: true,
  });

  if (contributionError) {
    await admin.from(DATABASE_TABLES.PAYMENT_INTENTS).delete().eq('id', paymentIntent.id);
    logger.error('Failed to create public contribution', { error: contributionError });
    throw new Error('Failed to create public contribution');
  }

  const expiresInSeconds = expiresInSecondsFrom(expiresAt);

  return {
    payment_intent: {
      id: paymentIntent.id,
      amount_btc: Number(paymentIntent.amount_btc),
      payment_method: paymentIntent.payment_method,
      status: paymentIntent.status,
      expires_at: paymentIntent.expires_at,
      can_acknowledge:
        paymentIntent.payment_method === 'lightning_address' && !paymentIntent.lnurl_verify_url,
    },
    status_token: token,
    qr_data: invoice.qr_data,
    method_label: METHOD_LABELS[wallet.method] || wallet.method,
    expires_in_seconds: expiresInSeconds,
  } as InitiatePublicSupportResult;
}

/**
 * Initiate a tip — an unconditional, account-free Bitcoin gift to a PERSON.
 *
 * Unlike public support, a tip has no entity: it creates an entity-less
 * payment_intent (intent_kind='tip') against the recipient's OWN wallet, so it
 * settles non-custodially and rides the exact same status-poll + settle path.
 * When it settles, {@link handlePaymentConfirmed} notifies the recipient. The
 * caller (tips domain) resolves the recipient + wallet; this only mints the
 * intent. Returns the same public shape as support: a bearer status token the
 * anonymous tipper polls with.
 */
export async function initiateTip(input: InitiateTipInput): Promise<InitiatePublicSupportResult> {
  const { recipientUserId, recipientName, wallet, amountBtc } = input;
  const description = `Tip for ${recipientName}`;
  const invoice = await generateInvoice(wallet, amountBtc, description);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = resolveIntentExpiry(wallet.method, invoice.expires_at);
  const admin = getAdminClient() as unknown as SupabaseClient;

  const { data: paymentIntent, error: paymentError } = await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .insert({
      buyer_id: null,
      seller_id: recipientUserId,
      entity_type: null,
      entity_id: null,
      amount_btc: amountBtc,
      payment_method: wallet.method,
      intent_kind: 'tip',
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

  if (paymentError || !paymentIntent) {
    logger.error('Failed to create tip payment intent', { error: paymentError });
    throw new Error('Failed to create tip payment intent');
  }

  const expiresInSeconds = expiresInSecondsFrom(expiresAt);

  return {
    payment_intent: {
      id: paymentIntent.id,
      amount_btc: Number(paymentIntent.amount_btc),
      payment_method: paymentIntent.payment_method,
      status: paymentIntent.status,
      expires_at: paymentIntent.expires_at,
      // Tips v1 confirm only on auto-detected rails (NWC / LUD-21 verify /
      // on-chain). A bare Lightning address with no verify URL simply shows the
      // QR without live confirmation — no manual "I paid" override.
      can_acknowledge: false,
    },
    status_token: token,
    qr_data: invoice.qr_data,
    method_label: METHOD_LABELS[wallet.method] || wallet.method,
    expires_in_seconds: expiresInSeconds,
  } as InitiatePublicSupportResult;
}
