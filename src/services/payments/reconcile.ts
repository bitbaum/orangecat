/**
 * Payment reconciliation sweep — converge OrangeCat's record of money with
 * reality, without depending on anyone's browser being open.
 *
 * OrangeCat is non-custodial: the invoice belongs to the recipient's wallet, so
 * the truth about a payment lives at their provider or on the chain. Our
 * `payment_intents` row is a cache of someone else's fact, and caches must be
 * reconciled — nothing pushes settlement to us.
 *
 * Until this existed, the only thing that ever asked was the payer's open tab.
 * Pay, close the tab, and the sats landed while our record stayed
 * `invoice_ready` forever: the recipient never got their notification, and for
 * entity funding no contribution row was written, so the totals stayed at zero.
 *
 * This is a BACKSTOP, not the primary path — the browser's 3s poll still covers
 * the common case. It therefore optimises for certainty, not latency: run every
 * minute, take a bounded batch, ask the same detection path the browser uses.
 *
 * Extracted from app/api/cron/payment-reconcile/route.ts (pure move) — the
 * route is a thin wrapper: cron-secret check + this sweep + HTTP response.
 */

import { BUYER_CLAIM_GRACE_MS } from '@/domain/payments/intentExpiry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { getAdminClient } from '@/lib/supabase/admin';
import { reconcilePaymentIntent } from '@/domain/payments/paymentFlowService';
import type { PaymentIntent } from '@/domain/payments/types';
import { logger } from '@/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Non-terminal statuses — the only ones worth asking about. */
const SWEEPABLE_STATUSES = [
  STATUS.PAYMENT_INTENTS.CREATED,
  STATUS.PAYMENT_INTENTS.INVOICE_READY,
  STATUS.PAYMENT_INTENTS.PENDING_CONFIRMATION,
];

/**
 * Only rails that can be checked without human input.
 *
 * A bare Lightning address (no LUD-21 verify URL) is deliberately excluded: it
 * is genuinely undetectable, and guessing would be worse than the honest
 * buyer-confirms → recipient-confirms fallback that already handles it.
 */
/**
 * How long we keep asking the chain about an unpaid on-chain intent.
 *
 * On-chain intents never expire — a Bitcoin address does not stop accepting
 * money, so recording "expired" would assert something we cannot know (see
 * domain/payments/intentExpiry). But non-terminal must not mean watched
 * forever: without a horizon, every abandoned QR ever generated would be
 * re-polled against mempool.space for the life of the platform.
 *
 * So the bound lives here, in the operational layer, where it means "we stopped
 * asking" — not in the record, where it would mean "no money arrived". 30 days
 * is far beyond any real confirmation delay, including a stuck fee market.
 */
const ONCHAIN_WATCH_HORIZON_DAYS = 30;

/**
 * Built per-tick because two clauses carry moving cutoffs.
 *
 * The last clause is the one exception to "detectable only": a bare Lightning
 * address is undetectable, but once its invoice is dead AND the buyer-claim
 * window has closed, "expired" is a fact, not a guess — no new payment is
 * possible and no claim is forthcoming. Sweeping those keeps the non-terminal
 * pool from accumulating stale rows forever. The shared reconcile path applies
 * the same rule, so including them here just gives it a caller.
 */
function sweepCandidatesFilter(): string {
  const horizon = new Date(
    Date.now() - ONCHAIN_WATCH_HORIZON_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const claimCutoff = new Date(Date.now() - BUYER_CLAIM_GRACE_MS).toISOString();

  return [
    'and(payment_method.eq.nwc,payment_hash.not.is.null)',
    'and(payment_method.eq.lightning_address,lnurl_verify_url.not.is.null)',
    `and(payment_method.eq.onchain,onchain_address.not.is.null,created_at.gte.${horizon})`,
    `and(payment_method.eq.lightning_address,lnurl_verify_url.is.null,expires_at.lt.${claimCutoff})`,
  ].join(',');
}

const BATCH_SIZE = 25;
/** Leave headroom under the systemd unit's 120s curl timeout. */
const BUDGET_MS = 45_000;

/**
 * Least-recently-asked first (never-asked first of all). With a bare LIMIT the
 * same oldest intents would be re-polled every tick while newer ones starved;
 * this ordering is self-balancing and bounds calls to third-party rails.
 */
async function pickCandidates(admin: SupabaseClient, limit: number): Promise<PaymentIntent[]> {
  const { data, error } = await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .select('*')
    .in('status', SWEEPABLE_STATUSES)
    .or(sweepCandidatesFilter())
    .order('last_polled_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to select reconciliation candidates: ${error.message}`);
  }
  return (data ?? []) as PaymentIntent[];
}

/**
 * Stamped BEFORE asking, so a rail that hangs or errors rotates to the back of
 * the queue instead of blocking every later intent on the next tick.
 */
async function markPolled(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .update({ last_polled_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    logger.warn('Failed to stamp last_polled_at', { paymentIntentId: id, error }, 'PaymentSweep');
  }
}

/**
 * Grace before a paid-but-unmarked intent counts as incomplete.
 *
 * Settlement is fast, but it is not instantaneous, and reporting an intent that
 * is mid-flight would train everyone to ignore this. Five minutes is far longer
 * than the path takes and far shorter than anyone would want to sit on a lost
 * order.
 */
const SIDE_EFFECT_GRACE_MS = 5 * 60 * 1000;

/** Most incomplete settlements to name in one report. */
const INCOMPLETE_REPORT_LIMIT = 20;

/**
 * Paid intents whose settlement side-effects never finished.
 *
 * handlePaymentConfirmed flips the intent to paid FIRST — that conditional
 * update is the lock making settlement run exactly once — and only then writes
 * the order, decrements inventory, notifies and fans out webhooks. A crash in
 * that gap used to lose all of it in total silence: the row is paid, so every
 * later observer skips it as already settled, refresh short-circuits on
 * terminal statuses, and the sweep above only looks at non-terminal ones. The
 * buyer's money is gone and their order sits in pending_payment forever.
 *
 * WHY THIS REPORTS AND DOES NOT REPLAY
 *
 * Replaying looks like the obvious fix and is a worse bug. `decrement_inventory`
 * is a blind `inventory_count - 1` with no idempotency key, so re-running
 * settlement for one sale decrements twice and quietly destroys stock; plan
 * grants and entitlements have the same shape. Trading an invisible loss for a
 * silent corruption is not progress. Making replay safe needs per-effect
 * receipts — a separate, larger piece of work. Until then this converts a
 * permanent silent loss into a named, actionable one, which is the part that
 * could not wait.
 */
export async function findIncompleteSettlements(
  admin: SupabaseClient
): Promise<{ count: number; ids: string[] }> {
  const cutoff = new Date(Date.now() - SIDE_EFFECT_GRACE_MS).toISOString();

  const { data, error } = await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .select('id')
    .eq('status', STATUS.PAYMENT_INTENTS.PAID)
    .is('side_effects_at', null)
    .lt('paid_at', cutoff)
    .order('paid_at', { ascending: true })
    .limit(INCOMPLETE_REPORT_LIMIT + 1);

  if (error) {
    // Never fail the sweep over the report: the reconciliation above is the
    // load-bearing half. But say so — a detector that goes quiet on error is
    // indistinguishable from one finding nothing, which is this whole bug.
    logger.error('Could not check for incomplete settlements', { error }, 'PaymentSweep');
    return { count: 0, ids: [] };
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return { count: 0, ids: [] };
  }

  const ids = rows.slice(0, INCOMPLETE_REPORT_LIMIT).map(r => (r as { id: string }).id);
  logger.error(
    'Paid payment intents whose settlement side-effects never completed — needs reconciliation',
    {
      shown: ids.length,
      more: rows.length > INCOMPLETE_REPORT_LIMIT,
      paymentIntentIds: ids,
      whatIsMissing:
        'order status, inventory decrement, seller notification, webhooks — check each before repairing by hand',
    },
    'PaymentSweep'
  );

  return { count: ids.length, ids };
}

export interface ReconcileSweepResult {
  scanned: number;
  settled: number;
  expired: number;
  skippedForBudget?: number;
  /** Paid intents whose side-effects never finished — reported, never replayed. */
  incompleteSettlements: number;
  ranAt: string;
}

/** Run one bounded reconciliation sweep. Throws on selection failure. */
export async function runPaymentReconcileSweep(): Promise<ReconcileSweepResult> {
  const startedAt = Date.now();
  const admin = getAdminClient() as unknown as SupabaseClient;
  const candidates = await pickCandidates(admin, BATCH_SIZE);

  // Runs even when there is nothing to reconcile: an incomplete settlement is a
  // PAID row, so it never appears among the candidates above. Skipping the
  // check on a quiet tick would hide exactly the case it exists for.
  const incomplete = await findIncompleteSettlements(admin);

  if (candidates.length === 0) {
    return {
      scanned: 0,
      settled: 0,
      expired: 0,
      incompleteSettlements: incomplete.count,
      ranAt: new Date().toISOString(),
    };
  }

  let scanned = 0;
  let settled = 0;
  let expired = 0;
  let skippedForBudget = 0;

  for (const intent of candidates) {
    if (Date.now() - startedAt > BUDGET_MS) {
      // Whatever is left keeps its old last_polled_at, so the next tick takes
      // it first. Never silently pretend the batch was fully covered.
      skippedForBudget = candidates.length - scanned;
      break;
    }

    await markPolled(admin, intent.id);
    scanned += 1;

    try {
      // The SAME path the payer's browser runs. Settlement side-effects are
      // exactly-once (claimPaidTransition), so overlapping with a live poll
      // is safe by construction.
      const result = await reconcilePaymentIntent(intent);
      if (result.status === STATUS.PAYMENT_INTENTS.PAID) {
        settled += 1;
        logger.info(
          'Reconciliation settled a payment nobody was watching',
          { paymentIntentId: intent.id, method: intent.payment_method },
          'PaymentSweep'
        );
      } else if (result.status === STATUS.PAYMENT_INTENTS.EXPIRED) {
        expired += 1;
      }
    } catch (error) {
      // One unreachable rail must not abort the sweep.
      logger.warn(
        'Reconciliation check failed for one intent',
        { paymentIntentId: intent.id, error },
        'PaymentSweep'
      );
    }
  }

  if (skippedForBudget > 0) {
    logger.info(
      'Reconciliation sweep hit its time budget',
      { scanned, skippedForBudget },
      'PaymentSweep'
    );
  }

  return {
    scanned,
    settled,
    expired,
    skippedForBudget,
    incompleteSettlements: incomplete.count,
    ranAt: new Date().toISOString(),
  };
}
