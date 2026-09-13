/**
 * payment.settled webhook fan-out.
 *
 * When a Bitcoin payment settles, deliver a `payment.settled` event to every
 * active webhook endpoint bound to the seller's actor. This closes the gap
 * where the mint UI advertised subscription/payment delivery but only
 * `<entity>.created` ever fired: settlement signals previously reached
 * Loki only via the out-of-band HMAC POST in entitlement-notify. Now any
 * integrator (Loki included) can subscribe through the generic,
 * retried, per-actor webhook machinery.
 *
 * Fire-and-forget: never throws, never blocks settlement. The seller's PERSONAL
 * actor is the fan-out target (the actor an individual seller mints endpoints
 * against) — group-owned entities that route settlement through a group actor
 * are not covered here and remain served by the direct Loki rail.
 */
import { getAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { enqueueWebhookEvent } from '@/services/webhooks/deliveryService';
import { logger } from '@/utils/logger';
import type { PaymentIntent } from '@/domain/payments/types';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/** Must match the economic event advertised in PUBLIC_API_WEBHOOK_EVENTS. */
export const PAYMENT_SETTLED_EVENT = 'payment.settled' as const;

export function buildPaymentSettledPayload(pi: PaymentIntent) {
  return {
    type: PAYMENT_SETTLED_EVENT,
    intentKind: pi.intent_kind,
    entityType: pi.entity_type,
    entityId: pi.entity_id,
    amountBtc: String(pi.amount_btc ?? ''),
    title: pi.description ?? undefined,
    externalId: pi.id,
  };
}

export async function enqueuePaymentSettledWebhook(pi: PaymentIntent): Promise<number> {
  try {
    const admin = getAdminClient() as unknown as AnySupabaseClient;
    const { data: actor } = await admin
      .from(DATABASE_TABLES.ACTORS)
      .select('id')
      .eq('user_id', pi.seller_id)
      .eq('actor_type', 'user')
      .maybeSingle();
    if (!actor?.id) {
      return 0;
    }
    return await enqueueWebhookEvent({
      actorId: actor.id,
      eventType: PAYMENT_SETTLED_EVENT,
      payload: buildPaymentSettledPayload(pi),
    });
  } catch (err) {
    logger.error('[payment-settled-webhook] enqueue failed (non-fatal)', {
      piId: pi.id,
      error: (err as Error).message,
    });
    return 0;
  }
}
