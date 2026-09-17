/**
 * Payment Flow — Status Detection & Confirmation
 *
 * Polling/reconciliation against the payment rails plus the manual
 * buyer/seller confirmation fallback for undetectable rails.
 * Extracted from paymentFlowService.ts (pure move).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import type { EntityType } from '@/config/entity-registry';
import { getAdminClient } from '@/lib/supabase/admin';
import { isBeyondClaimWindow } from './intentExpiry';
import {
  checkNWCPaymentStatus,
  checkOnchainPaymentStatus,
  checkLnurlVerifyPaymentStatus,
} from './paymentStatusService';
import type {
  PaymentStatusResult,
  PaymentIntentStatus,
  PaymentIntent,
  PublicPaymentStatusResult,
} from './types';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import { hashPublicStatusToken, updatePaymentStatus } from './paymentFlowHelpers';
import { handlePaymentConfirmed } from './paymentSettlement';

/**
 * Check payment status. For NWC, does active lookup; for others, returns DB status.
 */
export async function checkPaymentStatus(
  supabase: SupabaseClient,
  paymentIntentId: string,
  userId: string
): Promise<PaymentStatusResult> {
  // Fetch the payment intent
  const { data: pi } = await supabase
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .select('*')
    .eq('id', paymentIntentId)
    .single();

  if (!pi) {
    throw new Error('Payment not found');
  }

  // Verify access (buyer or seller)
  if (pi.buyer_id !== userId && pi.seller_id !== userId) {
    throw new Error('Access denied');
  }

  return refreshPaymentStatus(pi as PaymentIntent);
}

export async function checkPublicPaymentStatus(
  paymentIntentId: string,
  token: string
): Promise<PublicPaymentStatusResult> {
  const admin = getAdminClient() as unknown as SupabaseClient;
  const { data: pi } = await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .select('*')
    .eq('id', paymentIntentId)
    .eq('public_status_token_hash', hashPublicStatusToken(token))
    .maybeSingle();

  if (!pi) {
    throw new Error('Payment not found');
  }

  const result = await refreshPaymentStatus(pi as PaymentIntent);
  return {
    ...result,
    requires_recipient_confirmation: result.status === STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED,
  };
}

/**
 * Asked, once, whether this recipient may receive another claim.
 *
 * Injected rather than imported: rate limiting is infrastructure, and pulling
 * it in here would drag the limiter (limitkit and its store) into the payments
 * domain — wrong layer, and it breaks every domain test that has no business
 * knowing about it. The HTTP layer owns the policy; the domain owns WHEN it is
 * asked.
 */
export type ClaimGuard = (entityType: string, entityId: string) => Promise<boolean>;

export async function acknowledgePublicPayment(
  paymentIntentId: string,
  token: string,
  claimGuard?: ClaimGuard
): Promise<PublicPaymentStatusResult> {
  const admin = getAdminClient() as unknown as SupabaseClient;
  const { data: pi } = await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .select('*')
    .eq('id', paymentIntentId)
    .eq('public_status_token_hash', hashPublicStatusToken(token))
    .maybeSingle();

  if (!pi) {
    throw new Error('Payment not found');
  }
  if (pi.payment_method !== 'lightning_address' || pi.lnurl_verify_url) {
    throw new Error('This payment is confirmed automatically');
  }
  if (pi.status === STATUS.PAYMENT_INTENTS.PAID) {
    return {
      status: STATUS.PAYMENT_INTENTS.PAID,
      paid_at: pi.paid_at,
      requires_recipient_confirmation: false,
    };
  }
  // Expiry bounds when the invoice could be PAID, not when payment can be
  // REPORTED. A payer who paid just before the bolt11 died must still be able
  // to say so — the claim is testimony the recipient confirms or declines, so
  // accepting it late risks nothing. Refuse only once the claim window has
  // also closed.
  if (
    pi.status === STATUS.PAYMENT_INTENTS.EXPIRED ||
    pi.status === STATUS.PAYMENT_INTENTS.FAILED ||
    isBeyondClaimWindow(pi.expires_at)
  ) {
    if (
      pi.status !== STATUS.PAYMENT_INTENTS.EXPIRED &&
      pi.status !== STATUS.PAYMENT_INTENTS.FAILED
    ) {
      await updatePaymentStatus(paymentIntentId, STATUS.PAYMENT_INTENTS.EXPIRED);
    }
    throw new Error('This payment request has expired');
  }
  if (pi.status === STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED) {
    return {
      status: STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED,
      paid_at: null,
      requires_recipient_confirmation: true,
    };
  }

  // Bound claims per RECIPIENT, not per caller — the abuse shape is many
  // addresses aimed at one seller's confirmation queue, which the caller-keyed
  // budget in front of this cannot see. Asked only on the real transition: the
  // idempotent re-claim paths above return before here, cost an attacker
  // nothing, and so must not consume a genuine payer's allowance either.
  if (claimGuard) {
    const allowed = await claimGuard(
      (pi.entity_type as string) ?? 'unknown',
      (pi.entity_id as string) ?? paymentIntentId
    );
    if (!allowed) {
      throw new Error('Too many payment claims for this recipient');
    }
  }

  await updatePaymentStatus(paymentIntentId, STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED);
  notifyRecipientOfClaim(pi as PaymentIntent);
  return {
    status: STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED,
    paid_at: null,
    requires_recipient_confirmation: true,
  };
}

/**
 * Tell the recipient a payer claims to have paid — fire-and-forget.
 *
 * A claim needs the recipient's action to settle (they confirm receipt in
 * their wallet); a claim nobody sees rots in buyer_confirmed forever. Called
 * only on the actual transition into BUYER_CONFIRMED, never on idempotent
 * re-claims, so the recipient is notified at most once per intent.
 */
function notifyRecipientOfClaim(pi: PaymentIntent): void {
  const entityTitle = pi.description?.split(': ')[1] || 'your listing';
  void NotificationDispatcher.dispatch({
    userId: pi.seller_id,
    type: 'payment',
    title: `Payment reported: ${pi.amount_btc} BTC`,
    message: `A supporter says they've paid ${pi.amount_btc} BTC for ${entityTitle}. Check your wallet and confirm receipt.`,
    data: { paymentIntentId: pi.id, amount_btc: pi.amount_btc, kind: 'buyer_claim' },
    sourceEntityType: (pi.entity_type as EntityType) ?? undefined,
    sourceEntityId: pi.entity_id ?? undefined,
    actionUrl: '/dashboard',
  });
}

async function refreshPaymentStatus(pi: PaymentIntent): Promise<PaymentStatusResult> {
  const terminalStatuses = new Set<PaymentIntentStatus>([
    STATUS.PAYMENT_INTENTS.PAID,
    STATUS.PAYMENT_INTENTS.EXPIRED,
    STATUS.PAYMENT_INTENTS.FAILED,
    STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED,
  ]);
  if (terminalStatuses.has(pi.status)) {
    return { status: pi.status, paid_at: pi.paid_at };
  }

  // NOTE: expiry is evaluated AFTER asking the rail, at the end of this
  // function. Declaring "expired" first meant a payment that landed in the last
  // seconds before expiry — with nobody polling at that moment — was recorded as
  // expired even though the money had arrived in the recipient's wallet. The
  // invoice deadline governs whether a NEW payment can be made; it says nothing
  // about whether one already was, and verify endpoints still report settled
  // afterwards. Ask first, expire only on a genuine no.

  if (pi.payment_method === 'nwc' && pi.payment_hash) {
    const paid = await checkNWCPaymentStatus(pi);
    if (paid) {
      await handlePaymentConfirmed(pi);
      return { status: STATUS.PAYMENT_INTENTS.PAID, paid_at: new Date().toISOString() };
    }
  }

  if (pi.payment_method === 'lightning_address' && pi.lnurl_verify_url) {
    const paid = await checkLnurlVerifyPaymentStatus(pi);
    if (paid) {
      await handlePaymentConfirmed(pi);
      return { status: STATUS.PAYMENT_INTENTS.PAID, paid_at: new Date().toISOString() };
    }
  }

  if (pi.payment_method === 'onchain' && pi.onchain_address) {
    const onchainStatus = await checkOnchainPaymentStatus(pi);
    if (onchainStatus === 'confirmed') {
      await handlePaymentConfirmed(pi);
      return { status: STATUS.PAYMENT_INTENTS.PAID, paid_at: new Date().toISOString() };
    }
    if (
      onchainStatus === 'in_mempool' &&
      pi.status !== STATUS.PAYMENT_INTENTS.PENDING_CONFIRMATION
    ) {
      await updatePaymentStatus(pi.id, STATUS.PAYMENT_INTENTS.PENDING_CONFIRMATION);
      return { status: STATUS.PAYMENT_INTENTS.PENDING_CONFIRMATION, paid_at: null };
    }
  }

  // A bare Lightning address (no verify URL) is undetectable — no rail was
  // asked above, so "expired" here would be a guess, and terminalizing early
  // would refuse the buyer's own "I've paid" claim while the claim window is
  // still open. Only once the invoice is dead AND the window has closed is
  // "expired" a fact: no new payment possible, no claim forthcoming.
  const undetectable = pi.payment_method === 'lightning_address' && !pi.lnurl_verify_url;
  if (undetectable) {
    if (isBeyondClaimWindow(pi.expires_at)) {
      await updatePaymentStatus(pi.id, STATUS.PAYMENT_INTENTS.EXPIRED);
      return { status: STATUS.PAYMENT_INTENTS.EXPIRED, paid_at: null };
    }
    return { status: pi.status, paid_at: pi.paid_at };
  }

  // The rail says no payment arrived. Only now is expiry the truth.
  if (pi.expires_at && new Date(pi.expires_at) < new Date()) {
    await updatePaymentStatus(pi.id, STATUS.PAYMENT_INTENTS.EXPIRED);
    return { status: STATUS.PAYMENT_INTENTS.EXPIRED, paid_at: null };
  }

  return { status: pi.status, paid_at: pi.paid_at };
}

/**
 * Reconcile one payment intent against its rail — the single detection path,
 * shared by the payer's browser poll and the background sweep.
 *
 * Deliberately NOT a second implementation: a copy would drift, and then two
 * parts of the product would disagree about whether money arrived.
 */
export async function reconcilePaymentIntent(pi: PaymentIntent): Promise<PaymentStatusResult> {
  return refreshPaymentStatus(pi);
}

/**
 * Buyer's manual "I've paid" fallback — ONLY for a bare Lightning address with no
 * LUD-21 verify URL, the single rail we cannot confirm automatically. Every other
 * method (NWC, verify-capable Lightning addresses, on-chain) is detected by
 * checkPaymentStatus, so manual confirmation is refused there: the buyer's word
 * must never override a trustworthy on-rail signal.
 */
export async function buyerConfirmPayment(
  supabase: SupabaseClient,
  paymentIntentId: string,
  buyerId: string
): Promise<PaymentStatusResult> {
  const { data: pi } = await supabase
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .select('*')
    .eq('id', paymentIntentId)
    .eq('buyer_id', buyerId)
    .single();

  if (!pi) {
    throw new Error('Payment not found');
  }

  if (pi.status === STATUS.PAYMENT_INTENTS.PAID) {
    return { status: STATUS.PAYMENT_INTENTS.PAID, paid_at: pi.paid_at };
  }

  // Already claimed — idempotent, and no second notification to the recipient.
  if (pi.status === STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED) {
    return { status: STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED, paid_at: null };
  }

  // Guard the trust boundary: only a bare Lightning address (no LUD-21 verify
  // URL) is genuinely undetectable. NWC (relay lookup), verify-capable Lightning
  // addresses, and on-chain (mempool confirmation) are all confirmed by
  // checkPaymentStatus — accepting the buyer's self-attestation there would let
  // the weakest signal flip an order to paid over a trustworthy one. Refuse it.
  const isUndetectable = pi.payment_method === 'lightning_address' && !pi.lnurl_verify_url;
  if (!isUndetectable) {
    throw new Error(
      'This payment is confirmed automatically — please wait for detection instead of confirming manually.'
    );
  }

  // Mark as buyer_confirmed — seller verifies in their wallet
  await updatePaymentStatus(paymentIntentId, STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED);
  notifyRecipientOfClaim(pi as PaymentIntent);

  return { status: STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED, paid_at: null };
}

/** Seller-side half of the fallback for Lightning Addresses without LUD-21. */
export async function sellerConfirmPayment(
  supabase: SupabaseClient,
  paymentIntentId: string,
  sellerId: string
): Promise<PaymentStatusResult> {
  const { data: pi } = await supabase
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .select('*')
    .eq('id', paymentIntentId)
    .eq('seller_id', sellerId)
    .maybeSingle();

  if (!pi) {
    throw new Error('Payment not found');
  }
  if (
    pi.status !== STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED ||
    pi.payment_method !== 'lightning_address' ||
    pi.lnurl_verify_url
  ) {
    throw new Error('Payment is not awaiting recipient confirmation');
  }

  await handlePaymentConfirmed(pi as PaymentIntent);
  return { status: STATUS.PAYMENT_INTENTS.PAID, paid_at: new Date().toISOString() };
}
