/**
 * The public side of reputation (ADR-0010): a seller's track record, the
 * reviews their customers let go public, the seller's one reply, and reports.
 *
 * What is public is decided in the database, not here:
 * actor_track_record() and public_deal_reviews() return counts and customer
 * reviews of sellers only — never sales volume, never what someone bought,
 * never a reviewer who did not choose to be named. This module only shapes
 * what those return and turns refusals into sentences.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import {
  DEAL_REVIEW_LIMITS,
  dealReviewReplySchema,
  dealReviewReportSchema,
} from '@/config/reputation';
import { actorNames, nameOf, type ActorName } from '@/domain/actors/names';
import { sha256Hex } from '@/domain/research/openScience';
import { alertOps } from '@/services/cat/ops-alert';
import { callRpc, fromTable } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export interface PublicDealReview {
  id: string;
  answers: Record<string, boolean>;
  /** Null when there was no text, or the operator hid it (see textHidden). */
  body: string | null;
  textHidden: boolean;
  created_at: string;
  /** Null unless the reviewer chose to be named: shown as a verified buyer. */
  reviewer: ActorName | null;
  reply: { body: string | null; hidden: boolean; created_at: string } | null;
}

export interface TrackRecord {
  dealsProvided: number;
  completed: number;
  refunded: number;
  cancelled: number;
  distinctCustomers: number;
  firstDealAt: string | null;
  lastDealAt: string | null;
  /** Of the public reviews that answer the headline question, how many said yes. */
  wouldDealAgain: { yes: number; of: number };
  recentReviews: PublicDealReview[];
}

interface TrackRecordRow {
  deals_provided: number;
  deals_provided_completed: number;
  deals_provided_refunded: number;
  deals_provided_cancelled: number;
  distinct_customers: number;
  first_deal_at: string | null;
  last_deal_at: string | null;
  would_deal_again_yes: number;
  would_deal_again_of: number;
}

export interface PublicReviewRow {
  review_id: string;
  answers: Record<string, boolean>;
  body: string | null;
  text_hidden: boolean;
  created_at: string;
  reviewer_actor_id: string | null;
  reply_body: string | null;
  reply_hidden: boolean | null;
  reply_created_at: string | null;
}

/** One row of public_deal_reviews() as the profile shows it. Pure. */
export function toPublicReview(
  row: PublicReviewRow,
  names: Map<string, ActorName>
): PublicDealReview {
  return {
    id: row.review_id,
    answers: row.answers,
    body: row.body,
    textHidden: row.text_hidden,
    created_at: row.created_at,
    reviewer: row.reviewer_actor_id ? nameOf(names, row.reviewer_actor_id) : null,
    reply: row.reply_created_at
      ? {
          body: row.reply_body,
          hidden: Boolean(row.reply_hidden),
          created_at: row.reply_created_at,
        }
      : null,
  };
}

/**
 * A seller's public track record, or null when they have sold nothing — a
 * profile with nothing to show hides the section, and someone who has only
 * bought shows nothing at all.
 */
export async function getTrackRecord(
  client: AnySupabaseClient,
  actorId: string
): Promise<TrackRecord | null> {
  const [counts, reviews] = (await Promise.all([
    callRpc(client, 'actor_track_record', { p_actor_id: actorId }),
    callRpc(client, 'public_deal_reviews', {
      p_actor_id: actorId,
      p_limit: DEAL_REVIEW_LIMITS.PUBLIC_REVIEWS_SHOWN,
    }),
  ])) as [
    { data: TrackRecordRow[] | null; error: unknown },
    { data: PublicReviewRow[] | null; error: unknown },
  ];
  if (counts.error) {
    throw counts.error;
  }
  const c = counts.data?.[0];
  if (!c || c.deals_provided === 0) {
    return null;
  }
  const rows = reviews.data ?? [];
  const named = rows.map(r => r.reviewer_actor_id).filter((id): id is string => Boolean(id));
  const names = await actorNames(client, [...new Set(named)]);
  return {
    dealsProvided: c.deals_provided,
    completed: c.deals_provided_completed,
    refunded: c.deals_provided_refunded,
    cancelled: c.deals_provided_cancelled,
    distinctCustomers: c.distinct_customers,
    firstDealAt: c.first_deal_at,
    lastDealAt: c.last_deal_at,
    wouldDealAgain: { yes: c.would_deal_again_yes, of: c.would_deal_again_of },
    recentReviews: rows.map(r => toPublicReview(r, names)),
  };
}

export type ReviewActionResult =
  { ok: true } | { ok: false; code: 'not_found' | 'bad_request' | 'conflict'; message: string };

/** RLS refusals and unique violations, as sentences. */
function refusal(
  error: { code?: string } | null,
  conflictMessage: string,
  notFoundMessage: string
): ReviewActionResult | null {
  if (!error) {
    return null;
  }
  if (error.code === '23505') {
    return { ok: false, code: 'conflict', message: conflictMessage };
  }
  if (error.code === '42501') {
    return { ok: false, code: 'not_found', message: notFoundMessage };
  }
  return null;
}

/** The seller answers a public review about them, once. The database checks it is theirs. */
export async function replyToReview(
  supabase: AnySupabaseClient,
  myActorIds: string[],
  reviewId: string,
  rawInput: unknown
): Promise<ReviewActionResult> {
  const parsed = dealReviewReplySchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: 'bad_request', message: 'Write a reply first.' };
  }
  const { data: subject } = (await callRpc(supabase, 'deal_review_public_subject', {
    p_review_id: reviewId,
  })) as { data: string | null };
  if (!subject || !myActorIds.includes(subject)) {
    return { ok: false, code: 'not_found', message: 'You can only reply to a review about you.' };
  }
  const { error } = (await fromTable(supabase, DATABASE_TABLES.DEAL_REVIEW_REPLIES).insert({
    review_id: reviewId,
    author_actor_id: subject,
    body: parsed.data.body,
    body_sha256: await sha256Hex(parsed.data.body),
  })) as { error: { code?: string; message?: string } | null };
  const refused = refusal(
    error,
    'You have already replied to this review. A reply cannot be changed.',
    'You can only reply to a review about you.'
  );
  if (refused) {
    return refused;
  }
  if (error) {
    throw error;
  }
  return { ok: true };
}

/**
 * Report a public review. The operator is told at once and can hide its text
 * (deal_review_moderation). Reporting never hides anything by itself: a pile
 * of reports from throwaway accounts must not be a way to bury an honest
 * negative review.
 */
export async function reportReview(
  supabase: AnySupabaseClient,
  reporterActorId: string,
  reviewId: string,
  rawInput: unknown
): Promise<ReviewActionResult> {
  const parsed = dealReviewReportSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: 'bad_request', message: 'Say what is wrong with this review.' };
  }
  const { error } = (await fromTable(supabase, DATABASE_TABLES.DEAL_REVIEW_REPORTS).insert({
    review_id: reviewId,
    reporter_actor_id: reporterActorId,
    reason: parsed.data.reason,
  })) as { error: { code?: string; message?: string } | null };
  const refused = refusal(
    error,
    'You have already reported this review. Thank you — it is being looked at.',
    'Review not found'
  );
  if (refused) {
    return refused;
  }
  if (error) {
    throw error;
  }
  // The reporter's own words stay out of the alert: its message becomes a
  // prefilled question to the operator's Cat, and a stranger's text must not
  // be able to write instructions there. The reason is in deal_review_reports.
  await alertOps({
    code: `deal_review_report:${reviewId}`,
    source: 'reputation',
    message: `A public deal review (${reviewId}) was reported. Reasons are in deal_review_reports. To hide its text: INSERT INTO deal_review_moderation (review_id, text_hidden_at, reason) VALUES ('${reviewId}', now(), '<why>');`,
    metadata: { reviewId },
  });
  return { ok: true };
}
