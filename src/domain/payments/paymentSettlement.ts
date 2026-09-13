/**
 * Payment Flow — Settlement
 *
 * The exactly-once transition to `paid` and every side-effect that follows it
 * (order status, inventory, notifications, entitlements, webhooks).
 * Extracted from paymentFlowService.ts (pure move).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { getAdminClient } from '@/lib/supabase/admin';
import type { PaymentIntent } from './types';
import { logger } from '@/utils/logger';
import { sendSellerPaymentNotification } from '@/lib/email/send-seller-notification';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import {
  notifyLokiEntitlement,
  notifyLokiProjectFunding,
} from '@/services/loki/entitlement-notify';
import { grantSupporterPlan } from '@/services/supporter/grant';
import { enqueuePaymentSettledWebhook } from '@/services/webhooks/paymentSettledWebhook';

/**
 * Claim the transition to `paid`, exactly once.
 *
 * Settlement is observed, never owned: OrangeCat is non-custodial, so the truth
 * lives in the recipient's wallet and we learn about it by asking (a browser
 * poll, a background sweep, a recipient confirming). Any number of observers
 * may therefore report the same payment at the same moment.
 *
 * A plain `UPDATE … SET status='paid'` let every one of them proceed to the
 * side-effects: inventory would be decremented twice (overselling), Supporter
 * plans granted twice, the recipient notified twice, webhooks fanned twice.
 *
 * The row's own status is the lock. A conditional update is atomic in Postgres,
 * so exactly one caller can move a not-yet-paid intent to paid, and only that
 * caller is entitled to run the settlement side-effects.
 *
 * @returns true when THIS caller won the transition; false when someone else
 *          already settled it (a safe, silent no-op).
 */
async function claimPaidTransition(paymentIntentId: string): Promise<boolean> {
  // Admin client, always: under a caller-scoped client, RLS (UPDATE granted to
  // buyers only) makes this conditional update match zero rows WITHOUT an error
  // — indistinguishable from "another observer won the race" — so a recipient's
  // confirmation skipped every side-effect while the API reported paid.
  const admin = getAdminClient() as unknown as SupabaseClient;
  const { data, error } = await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .update({ status: STATUS.PAYMENT_INTENTS.PAID, paid_at: new Date().toISOString() })
    .eq('id', paymentIntentId)
    .neq('status', STATUS.PAYMENT_INTENTS.PAID)
    .select('id');

  // Same reasoning as updatePaymentStatus: a swallowed error here would leave
  // money state diverging from reality while the caller reports success.
  if (error) {
    logger.error('Failed to claim paid transition', { paymentIntentId, error });
    throw new Error('Failed to update payment status');
  }

  return (data?.length ?? 0) > 0;
}

/**
 * Record that the settlement path finished.
 *
 * `claimPaidTransition` flips the intent to paid FIRST — that conditional update
 * is the lock that makes settlement run exactly once — so between it and the
 * work below there is a window where a crash loses the order, the inventory
 * decrement, the notifications and the webhooks FOREVER: the row is paid, so
 * every later observer skips it as already settled, refresh short-circuits on
 * terminal statuses, and the reconcile cron only sweeps non-terminal ones.
 *
 * This marker makes that window visible. NULL on a paid intent means the
 * side-effects did not complete, which the reconcile sweep reports.
 *
 * What it does NOT claim: several effects are deliberately fire-and-forget
 * (`void ...`), so this says the settlement path RAN TO COMPLETION, not that
 * every async fan-out landed. Distinguishing those needs per-effect receipts,
 * which is a different piece of work.
 *
 * Never throws. The payment is already settled; failing the caller here would
 * 500 a buyer whose money has moved, and the terminal-status short-circuit
 * means the retry would not re-run anything anyway.
 */
async function markSideEffectsComplete(
  paymentIntentId: string,
  admin: SupabaseClient
): Promise<void> {
  const { error } = await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .update({ side_effects_at: new Date().toISOString() })
    .eq('id', paymentIntentId);

  if (error) {
    // The sweep will now report this intent as incomplete when it is not. A
    // false positive that names a real settled payment is a far better failure
    // than a silent one that names nothing.
    logger.error('Failed to mark settlement side-effects complete', {
      paymentIntentId,
      error,
    });
  }
}

/**
 * Settle a payment verified OUTSIDE the polling loop — e.g. an L402 preimage
 * proof. Callers must hold cryptographic (or rail-confirmed) evidence of
 * settlement; this is NOT a way to mark a payment paid on a caller's say-so.
 * Idempotent via {@link claimPaidTransition}.
 */
export async function settleVerifiedPayment(paymentIntent: PaymentIntent): Promise<void> {
  await handlePaymentConfirmed(paymentIntent);
}

/**
 * Handle side-effects when a payment is confirmed as paid.
 *
 * Runs at most once per payment intent — see {@link claimPaidTransition}.
 */
export async function handlePaymentConfirmed(paymentIntent: PaymentIntent): Promise<void> {
  const piId = paymentIntent.id;
  const entityType = paymentIntent.entity_type as EntityType;
  const entityId = paymentIntent.entity_id;

  // Settlement side-effects span multiple users' data (the buyer's order, the
  // seller's notification, the entity's inventory) — no single user-scoped
  // client can be entitled to all of it. Authorization already happened at the
  // call sites; from here on, writes are system writes.
  const admin = getAdminClient() as unknown as SupabaseClient;

  // Mark payment intent as paid — and only continue if we were the observer
  // that actually moved it there. Losing the race means another poller (or the
  // recipient's confirmation) already ran every side-effect below.
  const claimed = await claimPaidTransition(piId);
  if (!claimed) {
    logger.info(
      'Payment already settled by another observer — skipping duplicate side-effects',
      { paymentIntentId: piId },
      'paymentFlowService'
    );
    return;
  }

  // A tip is a person-to-person gift with no entity — none of the entity-scoped
  // side-effects below apply (and getEntityMetadata would throw on a null type).
  // Notify the recipient and fan the settlement out to their webhooks, then stop.
  if (paymentIntent.intent_kind === 'tip') {
    const tipAmount = paymentIntent.amount_btc;
    void NotificationDispatcher.dispatch({
      userId: paymentIntent.seller_id,
      type: 'payment',
      title: `You received a tip: ${tipAmount} BTC`,
      message: `Someone sent you a ${tipAmount} BTC tip — paid straight to your wallet.`,
      data: { paymentIntentId: piId, amount_btc: tipAmount, kind: 'tip' },
      actionUrl: '/dashboard',
    });
    void enqueuePaymentSettledWebhook(paymentIntent).catch(err =>
      logger.warn('payment.settled webhook enqueue failed (tip)', { err }, 'paymentFlowService')
    );
    await markSideEffectsComplete(piId, admin);
    return;
  }

  const meta = getEntityMetadata(entityType);

  if (paymentIntent.intent_kind === 'purchase' && meta.paymentPattern === 'fixed_price') {
    // Update order status. The payment is already verified+paid, so we must NOT
    // throw here (that would 500 the buyer's status check after a successful
    // payment, and the terminal-status short-circuit means a retry wouldn't
    // re-run this anyway). But a silent failure left the order stuck in
    // pending_payment with no trace — log it loudly so it can be reconciled.
    const { error: orderError } = await admin
      .from(DATABASE_TABLES.ORDERS)
      .update({ status: STATUS.ORDERS.PAID })
      .eq('payment_intent_id', piId);
    if (orderError) {
      logger.error('Order status update failed after confirmed payment — needs reconciliation', {
        paymentIntentId: piId,
        entityType,
        entityId,
        error: orderError,
      });
    }

    // Decrement inventory (atomic — prevents overselling)
    await admin
      .rpc('decrement_inventory', {
        p_entity_type: entityType,
        p_entity_id: entityId,
      })
      .then(({ error }) => {
        if (error) {
          // Non-fatal: some entities don't have inventory
          logger.warn('Inventory decrement skipped', {
            entityType,
            entityId,
            error: error.message,
          });
        }
      });
  }

  // Notify seller — fire-and-forget, must not block payment confirmation
  sendSellerPaymentNotification(paymentIntent, admin).catch(err =>
    logger.warn('Seller payment notification failed', { err }, 'paymentFlowService')
  );

  // Grant a Loki pass if this payment was for one — fire-and-forget,
  // never blocks settlement. No-op for normal sales / when unconfigured.
  if (paymentIntent.intent_kind === 'purchase') {
    void notifyLokiEntitlement(paymentIntent).catch(err =>
      logger.warn('Loki entitlement notify failed', { err }, 'paymentFlowService')
    );
  }

  // Funding on a Loki-linked project → activity signal for the fleet.
  // Fire-and-forget; the receiver drops events for unlinked entities.
  void notifyLokiProjectFunding(paymentIntent).catch(err =>
    logger.warn('Loki funding notify failed', { err }, 'paymentFlowService')
  );

  // Fan `payment.settled` out to the seller's own webhook endpoints — the
  // generic, retried rail any integrator can subscribe to. Fire-and-forget.
  void enqueuePaymentSettledWebhook(paymentIntent).catch(err =>
    logger.warn('payment.settled webhook enqueue failed', { err }, 'paymentFlowService')
  );

  // Grant an OrangeCat Supporter plan if this product was a Supporter pass —
  // fire-and-forget, never blocks settlement. No-op for normal sales.
  if (paymentIntent.intent_kind === 'purchase') {
    void grantSupporterPlan(paymentIntent).catch(err =>
      logger.warn('Supporter plan grant failed', { err }, 'paymentFlowService')
    );
  }

  // Also create in-app notification for the seller
  const entityTitle = paymentIntent.description?.split(': ')[1] || 'your listing';
  const amount = paymentIntent.amount_btc;
  void NotificationDispatcher.dispatch({
    userId: paymentIntent.seller_id,
    type: 'payment',
    title: `Payment received: ${amount} BTC`,
    message: `You received ${amount} BTC for ${entityTitle}.`,
    data: { paymentIntentId: piId, amount_btc: amount },
    sourceEntityType: entityType,
    sourceEntityId: entityId,
    actionUrl: `/dashboard`,
  });

  await markSideEffectsComplete(piId, admin);
}
