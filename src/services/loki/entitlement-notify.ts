/**
 * Loki entitlement notifier — the OrangeCat→Loki settlement signal.
 *
 * When a Bitcoin payment for a Loki "pass" product settles, we tell
 * Loki to grant the plan. Loki's /api/orangecat/entitlement verifies
 * the HMAC, maps the OC actor → its user, and flips the plan (time-boxed, since
 * BTC has no native recurring). Idempotent on Loki's side via externalId
 * (the payment-intent id), so a retried settlement check is safe.
 *
 * A pass product is marked with two tags: `loki-plan:<personal|pro|team>`
 * and `loki-days:<n>`. Non-pass payments are ignored. Fire-and-forget:
 * never throws, never blocks settlement — a dropped notify is recoverable (re-send
 * is idempotent, and Loki can reconcile).
 *
 * Inert until ORANGECAT_WEBHOOK_SECRET is set (shared with Loki).
 */
import { postSignedToLoki } from './signed-post';
import { getAdminClient } from '@/lib/supabase/admin';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { logger } from '@/utils/logger';
import type { PaymentIntent } from '@/domain/payments/types';
import { parseLokiPass } from '@/config/loki-passes';
import { getUserActorId } from '@/domain/actors';

const LOKI_URL =
  process.env.LOKI_ENTITLEMENT_URL || 'https://loki.orangecat.ch/api/orangecat/entitlement';

// parseLokiPass + the plan set live in the config SSOT (the seed writes
// the very tags this reads), re-exported here for existing importers.
export { parseLokiPass };

const LOKI_EVENTS_URL =
  process.env.LOKI_EVENTS_URL || 'https://loki.orangecat.ch/api/orangecat/events';

/**
 * Settled-payment signal for Loki-linked projects: when money lands on
 * an OC project that a Loki project published itself as, tell the fleet —
 * settled funding is the ground-truth signal the capability layer can't derive
 * on its own. Loki drops events for unlinked entities, so we send for
 * every settled project payment and let the receiver filter. Same shared
 * secret, fire-and-forget, inert until ORANGECAT_WEBHOOK_SECRET is set.
 */
export async function notifyLokiProjectFunding(pi: PaymentIntent): Promise<void> {
  const secret = process.env.ORANGECAT_WEBHOOK_SECRET;
  if (!secret) {
    return;
  }
  const meta = getEntityMetadata(pi.entity_type as EntityType);
  if (pi.intent_kind !== 'support' || !meta.canReceiveSupport) {
    return;
  }

  try {
    const result = await postSignedToLoki(LOKI_EVENTS_URL, {
      type: 'payment.settled',
      entityType: pi.entity_type,
      entityId: pi.entity_id,
      title: pi.description ?? undefined,
      amountBtc: String(pi.amount_btc ?? ''),
      externalId: pi.id,
    });
    if (!result.ok) {
      logger.warn('[loki-funding] Loki rejected event', {
        piId: pi.id,
        status: result.status,
      });
    }
  } catch (err) {
    logger.error('[loki-funding] notify failed (non-fatal)', {
      piId: pi.id,
      error: (err as Error).message,
    });
  }
}

export async function notifyLokiEntitlement(pi: PaymentIntent): Promise<void> {
  const secret = process.env.ORANGECAT_WEBHOOK_SECRET;
  if (!secret) {
    return;
  } // not wired to Loki yet — inert
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
    const pass = parseLokiPass(product?.tags);
    if (!pass) {
      return;
    } // a normal product sale, not a Loki pass

    // The buyer's PERSONAL actor id is what Loki stored as orangecatActorId
    // (= the OIDC id_token.sub). buyer_id is the user id — resolve via admin
    // (headless: no session), never create here.
    // buyer_id is nullable. The old inline query passed it straight into
    // .eq('user_id', …), so a null buyer silently matched nothing; the typed
    // helper makes the case explicit instead.
    const actorId = pi.buyer_id ? await getUserActorId(admin, pi.buyer_id) : null;
    if (!actorId) {
      logger.warn('[loki-entitlement] no personal actor for buyer — cannot map to Loki', {
        buyerId: pi.buyer_id,
      });
      return;
    }

    const result = await postSignedToLoki(LOKI_URL, {
      actorId,
      plan: pass.plan,
      externalId: pi.id,
      periodDays: pass.periodDays,
      amountBtc: String(pi.amount_btc ?? ''),
    });
    if (!result.ok) {
      logger.warn('[loki-entitlement] Loki rejected grant', {
        piId: pi.id,
        status: result.status,
      });
    } else {
      logger.info('[loki-entitlement] granted', {
        piId: pi.id,
        plan: pass.plan,
        periodDays: pass.periodDays,
      });
    }
  } catch (err) {
    logger.error('[loki-entitlement] notify failed (non-fatal)', {
      piId: pi.id,
      error: (err as Error).message,
    });
  }
}
