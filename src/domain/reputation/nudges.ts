/**
 * Asking people to review their deals (ADR-0010).
 *
 * Most people never review unless asked, and a track record nobody writes
 * stays empty. The review-nudges cron asks each side that has not reviewed:
 * once a few days after the deal settles, once more just before the window
 * closes. Deterministic: no model is called, so the timer spends nothing.
 *
 * A nudge is recorded in deal_review_nudges BEFORE it is sent, so a crash can
 * lose one but never send it twice.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import {
  COUNTERPART_REVIEWED_COPY,
  DEAL_REVIEW_NOTIFICATION_TYPE,
  REVIEW_NUDGES,
  REVIEW_NUDGE_BATCH_COPY,
  REVIEW_NUDGE_COPY,
  REVIEWER_ROLES,
  type ReviewNudgeKind,
  type ReviewerRole,
} from '@/config/reputation';
import { ROUTES } from '@/config/routes';
import { actorNames, nameOf } from '@/domain/actors/names';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import { fromTable } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import type { DealStatus } from './service';

export interface NudgeDeal {
  id: string;
  title: string;
  status: DealStatus;
  settled_at: string;
  review_closes_at: string;
  provider_actor_id: string;
  customer_actor_id: string;
}

export interface DueNudge {
  dealId: string;
  title: string;
  role: ReviewerRole;
  kind: ReviewNudgeKind;
  recipientActorId: string;
  counterpartyActorId: string;
}

/** `${dealId}:${role}` for a side that has reviewed. */
export const sideKey = (dealId: string, role: ReviewerRole) => `${dealId}:${role}`;
/** `${dealId}:${role}:${kind}` for a nudge already sent. */
export const nudgeKey = (dealId: string, role: ReviewerRole, kind: ReviewNudgeKind) =>
  `${dealId}:${role}:${kind}`;

/** Which nudge, if any, a deal is due at `now`. The two windows never overlap. */
export function nudgeKindAt(
  deal: Pick<NudgeDeal, 'status' | 'settled_at' | 'review_closes_at'>,
  now: Date
): ReviewNudgeKind | null {
  const t = now.getTime();
  const closes = new Date(deal.review_closes_at).getTime();
  if (deal.status === 'cancelled' || t >= closes) {
    return null;
  }
  if (t >= closes - REVIEW_NUDGES.last_call.beforeCloseMs) {
    return 'last_call';
  }
  if (t >= new Date(deal.settled_at).getTime() + REVIEW_NUDGES.ask.afterSettledMs) {
    return 'ask';
  }
  return null;
}

/** Every side that should be asked now. Pure. */
export function dueNudges(
  deals: NudgeDeal[],
  reviewedSides: ReadonlySet<string>,
  sentNudges: ReadonlySet<string>,
  now: Date
): DueNudge[] {
  const due: DueNudge[] = [];
  for (const deal of deals) {
    const kind = nudgeKindAt(deal, now);
    if (!kind) {
      continue;
    }
    for (const role of REVIEWER_ROLES) {
      if (
        reviewedSides.has(sideKey(deal.id, role)) ||
        sentNudges.has(nudgeKey(deal.id, role, kind))
      ) {
        continue;
      }
      const customer = role === 'customer';
      due.push({
        dealId: deal.id,
        title: deal.title,
        role,
        kind,
        recipientActorId: customer ? deal.customer_actor_id : deal.provider_actor_id,
        counterpartyActorId: customer ? deal.provider_actor_id : deal.customer_actor_id,
      });
    }
  }
  return due;
}

/**
 * Tell the other side that this side has reviewed — THAT, never WHAT. The
 * strongest prompt there is: their review is waiting for yours. Only called
 * while the deal is still blind (the other side has not reviewed), so it fires
 * at most once per deal. Never throws; a lost notification costs a nudge.
 */
export async function notifyCounterpartReviewed(
  supabase: AnySupabaseClient,
  deal: Pick<NudgeDeal, 'id' | 'title' | 'provider_actor_id' | 'customer_actor_id'>,
  reviewerRole: ReviewerRole
): Promise<void> {
  try {
    const reviewerId =
      reviewerRole === 'customer' ? deal.customer_actor_id : deal.provider_actor_id;
    const counterpartId =
      reviewerRole === 'customer' ? deal.provider_actor_id : deal.customer_actor_id;
    const [{ data: counterpart }, names] = await Promise.all([
      fromTable(supabase, DATABASE_TABLES.ACTORS)
        .select('user_id')
        .eq('id', counterpartId)
        .maybeSingle() as Promise<{ data: { user_id: string | null } | null }>,
      actorNames(supabase, [reviewerId]),
    ]);
    if (!counterpart?.user_id) {
      return;
    }
    const reviewer = nameOf(names, reviewerId);
    const copy = COUNTERPART_REVIEWED_COPY({
      who: reviewer.name || reviewer.username || 'The other side',
      title: deal.title,
    });
    await NotificationDispatcher.dispatch({
      userId: counterpart.user_id,
      type: DEAL_REVIEW_NOTIFICATION_TYPE,
      title: copy.title,
      message: copy.message,
      actionUrl: ROUTES.DASHBOARD.DEALS,
      data: { deal_id: deal.id, nudge: 'counterpart_reviewed' },
      sourceActorId: reviewerId,
    });
  } catch (error) {
    logger.warn(
      'Could not tell the other side about a review',
      { error, dealId: deal.id },
      'ReviewNudges'
    );
  }
}

const BATCH = 500;

export interface NudgeRunResult {
  due: number;
  sent: number;
  skipped: number;
}

/** One cron run. `admin` must be the service-role client. */
export async function runReviewNudges(
  admin: AnySupabaseClient,
  now: Date = new Date()
): Promise<NudgeRunResult> {
  const settledBefore = new Date(now.getTime() - REVIEW_NUDGES.ask.afterSettledMs).toISOString();
  const { data: deals, error } = (await fromTable(admin, DATABASE_TABLES.DEALS)
    .select('id, title, status, settled_at, review_closes_at, provider_actor_id, customer_actor_id')
    .gt('review_closes_at', now.toISOString())
    .lte('settled_at', settledBefore)
    .neq('status', 'cancelled')
    .order('review_closes_at', { ascending: true })
    .limit(BATCH)) as { data: NudgeDeal[] | null; error: unknown };
  if (error) {
    throw error;
  }
  const rows = deals ?? [];
  if (rows.length === 0) {
    return { due: 0, sent: 0, skipped: 0 };
  }
  const ids = rows.map(d => d.id);
  const [{ data: reviews }, { data: nudges }] = (await Promise.all([
    fromTable(admin, DATABASE_TABLES.DEAL_REVIEWS)
      .select('deal_id, reviewer_role')
      .in('deal_id', ids),
    fromTable(admin, DATABASE_TABLES.DEAL_REVIEW_NUDGES)
      .select('deal_id, role, kind')
      .in('deal_id', ids),
  ])) as [
    { data: Array<{ deal_id: string; reviewer_role: ReviewerRole }> | null },
    { data: Array<{ deal_id: string; role: ReviewerRole; kind: ReviewNudgeKind }> | null },
  ];
  const due = dueNudges(
    rows,
    new Set((reviews ?? []).map(r => sideKey(r.deal_id, r.reviewer_role))),
    new Set((nudges ?? []).map(n => nudgeKey(n.deal_id, n.role, n.kind))),
    now
  );
  if (due.length === 0) {
    return { due: 0, sent: 0, skipped: 0 };
  }

  const actorIds = [...new Set(due.flatMap(n => [n.recipientActorId, n.counterpartyActorId]))];
  const [{ data: actors }, names] = await Promise.all([
    fromTable(admin, DATABASE_TABLES.ACTORS).select('id, user_id').in('id', actorIds) as Promise<{
      data: Array<{ id: string; user_id: string | null }> | null;
    }>,
    actorNames(admin, actorIds),
  ]);
  const userOf = new Map((actors ?? []).map(a => [a.id, a.user_id]));

  // Claim every due nudge first; a conflict means another run already sent it.
  let skipped = 0;
  const claimedByUser = new Map<string, DueNudge[]>();
  for (const nudge of due) {
    const userId = userOf.get(nudge.recipientActorId);
    if (!userId) {
      // A group or unclaimed actor has no single inbox to ask.
      skipped += 1;
      continue;
    }
    const { error: claimError } = (await fromTable(
      admin,
      DATABASE_TABLES.DEAL_REVIEW_NUDGES
    ).insert({
      deal_id: nudge.dealId,
      role: nudge.role,
      kind: nudge.kind,
    })) as { error: { code?: string; message?: string } | null };
    if (claimError) {
      if (claimError.code !== '23505') {
        logger.warn('Could not record review nudge', { claimError, nudge }, 'ReviewNudges');
      }
      skipped += 1;
      continue;
    }
    claimedByUser.set(userId, [...(claimedByUser.get(userId) ?? []), nudge]);
  }

  // Then ONE message per person per run, however many of their deals are due:
  // an active seller with twenty sales must not get twenty notifications.
  let sent = 0;
  for (const [userId, nudges] of claimedByUser) {
    const first = nudges[0];
    const counterparty = nameOf(names, first.counterpartyActorId);
    const who = counterparty.name || counterparty.username || 'the other side';
    const copy =
      nudges.length === 1
        ? REVIEW_NUDGE_COPY[first.kind]({ who, title: first.title, role: first.role })
        : REVIEW_NUDGE_BATCH_COPY(nudges.length);
    await NotificationDispatcher.dispatch({
      userId,
      type: DEAL_REVIEW_NOTIFICATION_TYPE,
      title: copy.title,
      message: copy.message,
      actionUrl: ROUTES.DASHBOARD.DEALS,
      data: { deal_ids: nudges.map(n => n.dealId), nudges: nudges.map(n => n.kind) },
      ...(nudges.length === 1 ? { sourceActorId: first.counterpartyActorId } : {}),
    });
    sent += nudges.length;
  }
  return { due: due.length, sent, skipped };
}
