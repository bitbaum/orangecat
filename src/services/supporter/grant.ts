/**
 * Supporter plan granter — OrangeCat's own pass-product checkout.
 *
 * Mirrors the Loki entitlement pattern (a product tagged for a plan →
 * on Bitcoin settlement, grant a time-boxed plan) but writes the grant LOCALLY
 * to user_plans instead of HTTP-notifying a sibling product. A Supporter
 * product carries two tags: `supporter-plan` and `supporter-days:<n>`. When it
 * settles, the buyer's user_plans row is upgraded to tier 'pro' (a raised daily
 * Cat cap) until now + n days. BTC has no native recurring, so a "subscription"
 * is a renewable time-boxed pass — buying again before expiry stacks the time.
 *
 * Fire-and-forget from handlePaymentConfirmed; never throws, never blocks
 * settlement. Inert in practice until a Supporter product exists and the
 * platform wallet (PLATFORM_NWC_URI) can receive — same gate as Cat Credits.
 */
import { getAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { CAT_SUPPORTER_DAILY_LIMIT } from '@/config/cat-plans';
import { logger } from '@/utils/logger';
import type { PaymentIntent } from '@/domain/payments/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** `{days}` if the product's tags mark it a Supporter pass, else null. */
export function parseSupporterPass(tags: unknown): { days: number } | null {
  if (!Array.isArray(tags)) {
    return null;
  }
  let isSupporter = false;
  let days: number | null = null;
  for (const raw of tags) {
    if (typeof raw !== 'string') {
      continue;
    }
    const t = raw.trim();
    if (t === 'supporter-plan') {
      isSupporter = true;
    }
    const d = /^supporter-days:(\d{1,4})$/.exec(t);
    if (d) {
      days = parseInt(d[1], 10);
    }
  }
  return isSupporter && days ? { days } : null;
}

export async function grantSupporterPlan(pi: PaymentIntent): Promise<void> {
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
    const pass = parseSupporterPass(product?.tags);
    if (!pass) {
      return;
    } // a normal product sale, not a Supporter pass

    // Idempotent: the same settled invoice must never extend twice. The
    // terminal-status short-circuit in checkPaymentStatus already fires this
    // once per intent; guarding on last_invoice_id is belt-and-suspenders.
    const { data: current } = await admin
      .from(DATABASE_TABLES.USER_PLANS)
      .select('expires_at, last_invoice_id')
      .eq('user_id', pi.buyer_id)
      .maybeSingle();
    if (current?.last_invoice_id === pi.id) {
      return;
    }

    const now = new Date();
    // Renewing before expiry stacks: extend from the later of now / current expiry.
    const base =
      current?.expires_at && new Date(current.expires_at) > now
        ? new Date(current.expires_at)
        : now;
    const expiresAt = new Date(base.getTime() + pass.days * DAY_MS);
    // user_plans.payment_method CHECK allows only lightning | onchain | manual.
    const paymentMethod = pi.payment_method === 'onchain' ? 'onchain' : 'lightning';

    const { error } = await admin.from(DATABASE_TABLES.USER_PLANS).upsert(
      {
        user_id: pi.buyer_id,
        tier: 'pro',
        daily_limit: CAT_SUPPORTER_DAILY_LIMIT,
        expires_at: expiresAt.toISOString(),
        started_at: now.toISOString(),
        payment_method: paymentMethod,
        last_invoice_id: pi.id,
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (error) {
      logger.warn('[supporter] grant upsert failed', { piId: pi.id, error }, 'supporter');
      return;
    }
    logger.info(
      '[supporter] granted',
      { userId: pi.buyer_id, days: pass.days, expiresAt: expiresAt.toISOString() },
      'supporter'
    );
  } catch (err) {
    logger.error(
      '[supporter] grant failed (non-fatal)',
      { piId: pi.id, error: (err as Error).message },
      'supporter'
    );
  }
}
