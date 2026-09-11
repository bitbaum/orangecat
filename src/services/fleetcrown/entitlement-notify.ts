/**
 * FleetCrown entitlement notifier — the OrangeCat→FleetCrown settlement signal.
 *
 * When a Bitcoin payment for a FleetCrown "pass" product settles, we tell
 * FleetCrown to grant the plan. FleetCrown's /api/orangecat/entitlement verifies
 * the HMAC, maps the OC actor → its user, and flips the plan (time-boxed, since
 * BTC has no native recurring). Idempotent on FleetCrown's side via externalId
 * (the payment-intent id), so a retried settlement check is safe.
 *
 * A pass product is marked with two tags: `fleetcrown-plan:<personal|pro|team>`
 * and `fleetcrown-days:<n>`. Non-pass payments are ignored. Fire-and-forget:
 * never throws, never blocks settlement — a dropped notify is recoverable (re-send
 * is idempotent, and FleetCrown can reconcile).
 *
 * Inert until ORANGECAT_WEBHOOK_SECRET is set (shared with FleetCrown).
 */
import { postSignedToFleetCrown } from './signed-post';
import { getAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { logger } from '@/utils/logger';
import type { PaymentIntent } from '@/domain/payments/types';
import { parseFleetCrownPass } from '@/config/fleetcrown-passes';

const FLEETCROWN_URL =
  process.env.FLEETCROWN_ENTITLEMENT_URL ||
  'https://fleetcrown.orangecat.ch/api/orangecat/entitlement';

// parseFleetCrownPass + the plan set live in the config SSOT (the seed writes
// the very tags this reads), re-exported here for existing importers.
export { parseFleetCrownPass };

const FLEETCROWN_EVENTS_URL =
  process.env.FLEETCROWN_EVENTS_URL || 'https://fleetcrown.orangecat.ch/api/orangecat/events';

/**
 * Settled-payment signal for FleetCrown-linked projects: when money lands on
 * an OC project that a FleetCrown project published itself as, tell the fleet —
 * settled funding is the ground-truth signal the capability layer can't derive
 * on its own. FleetCrown drops events for unlinked entities, so we send for
 * every settled project payment and let the receiver filter. Same shared
 * secret, fire-and-forget, inert until ORANGECAT_WEBHOOK_SECRET is set.
 */
export async function notifyFleetCrownProjectFunding(pi: PaymentIntent): Promise<void> {
  const secret = process.env.ORANGECAT_WEBHOOK_SECRET;
  if (!secret) {
    return;
  }
  const meta = getEntityMetadata(pi.entity_type as EntityType);
  if (pi.intent_kind !== 'support' || !meta.canReceiveSupport) {
    return;
  }

  try {
    const result = await postSignedToFleetCrown(FLEETCROWN_EVENTS_URL, {
      type: 'payment.settled',
      entityType: pi.entity_type,
      entityId: pi.entity_id,
      title: pi.description ?? undefined,
      amountBtc: String(pi.amount_btc ?? ''),
      externalId: pi.id,
    });
    if (!result.ok) {
      logger.warn('[fc-funding] FleetCrown rejected event', {
        piId: pi.id,
        status: result.status,
      });
    }
  } catch (err) {
    logger.error('[fc-funding] notify failed (non-fatal)', {
      piId: pi.id,
      error: (err as Error).message,
    });
  }
}

export async function notifyFleetCrownEntitlement(pi: PaymentIntent): Promise<void> {
  const secret = process.env.ORANGECAT_WEBHOOK_SECRET;
  if (!secret) {
    return;
  } // not wired to FleetCrown yet — inert
  if (pi.entity_type !== 'product') {
    return;
  } // only product passes carry a plan

  try {
    const admin = getAdminClient() as any;

    const meta = getEntityMetadata('product' as EntityType);
    const { data: product } = await admin
      .from(meta.tableName)
      .select('tags')
      .eq('id', pi.entity_id)
      .single();
    const pass = parseFleetCrownPass(product?.tags);
    if (!pass) {
      return;
    } // a normal product sale, not a FleetCrown pass

    // The buyer's PERSONAL actor id is what FleetCrown stored as orangecatActorId
    // (= the OIDC id_token.sub). buyer_id is the user id — resolve via admin
    // (headless: no session), never create here.
    const { data: actor } = await admin
      .from(DATABASE_TABLES.ACTORS)
      .select('id')
      .eq('user_id', pi.buyer_id)
      .eq('actor_type', 'user')
      .maybeSingle();
    if (!actor?.id) {
      logger.warn('[fc-entitlement] no personal actor for buyer — cannot map to FleetCrown', {
        buyerId: pi.buyer_id,
      });
      return;
    }

    const result = await postSignedToFleetCrown(FLEETCROWN_URL, {
      actorId: actor.id,
      plan: pass.plan,
      externalId: pi.id,
      periodDays: pass.periodDays,
      amountBtc: String(pi.amount_btc ?? ''),
    });
    if (!result.ok) {
      logger.warn('[fc-entitlement] FleetCrown rejected grant', {
        piId: pi.id,
        status: result.status,
      });
    } else {
      logger.info('[fc-entitlement] granted', {
        piId: pi.id,
        plan: pass.plan,
        periodDays: pass.periodDays,
      });
    }
  } catch (err) {
    logger.error('[fc-entitlement] notify failed (non-fatal)', {
      piId: pi.id,
      error: (err as Error).message,
    });
  }
}
