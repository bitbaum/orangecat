/**
 * Reputation — deals, the reviews on them, and an actor's public track record
 * (ADR-0010).
 *
 * The database holds every rule that must not be bypassed: who may review,
 * one review per side, the window, blindness, no edits. This module reads
 * through RLS and turns the database's refusals into sentences.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { HEADLINE_QUESTION, dealReviewInputSchema, type ReviewerRole } from '@/config/reputation';
import { actorNames, nameOf, type ActorName } from '@/domain/actors/names';
import { sha256Hex } from '@/domain/research/openScience';
import { notifyCounterpartReviewed } from './nudges';
import { callRpc, fromTable } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export type DealStatus = 'settled' | 'completed' | 'refunded' | 'cancelled';

export interface DealReviewView {
  role: ReviewerRole;
  answers: Record<string, boolean>;
  body: string | null;
  body_sha256: string | null;
  created_at: string;
}

export interface MyDeal {
  id: string;
  source: string;
  title: string;
  amount: number | null;
  currency: string | null;
  status: DealStatus;
  settled_at: string;
  review_closes_at: string;
  /** Which side of this deal I was on. */
  role: ReviewerRole;
  counterparty: ActorName;
  myReview: DealReviewView | null;
  /** Null until both sides have written or the window has closed. */
  theirReview: DealReviewView | null;
  canReview: boolean;
}

export interface DealRow {
  id: string;
  source: string;
  title: string;
  amount: number | string | null;
  currency: string | null;
  status: DealStatus;
  settled_at: string;
  review_closes_at: string;
  provider_actor_id: string;
  customer_actor_id: string;
}

export interface ReviewRow {
  deal_id: string;
  reviewer_actor_id: string;
  subject_actor_id: string;
  reviewer_role: ReviewerRole;
  answers: Record<string, boolean>;
  body: string | null;
  body_sha256: string | null;
  created_at: string;
}

const DEAL_COLUMNS =
  'id, source, title, amount, currency, status, settled_at, review_closes_at, provider_actor_id, customer_actor_id';
const REVIEW_COLUMNS =
  'deal_id, reviewer_actor_id, subject_actor_id, reviewer_role, answers, body, body_sha256, created_at';

function toReviewView(row: ReviewRow): DealReviewView {
  return {
    role: row.reviewer_role,
    answers: row.answers,
    body: row.body,
    body_sha256: row.body_sha256,
    created_at: row.created_at,
  };
}

/**
 * One deal as its party sees it. Pure, so the rules about what a party may do
 * next are testable without a database.
 */
export function toMyDeal(
  deal: DealRow,
  reviews: ReviewRow[],
  myActorIds: ReadonlySet<string>,
  names: Map<string, ActorName>,
  now: Date
): MyDeal {
  const role: ReviewerRole = myActorIds.has(deal.customer_actor_id) ? 'customer' : 'provider';
  const counterpartyId = role === 'customer' ? deal.provider_actor_id : deal.customer_actor_id;
  const mine = reviews.find(r => r.deal_id === deal.id && r.reviewer_role === role);
  const theirs = reviews.find(r => r.deal_id === deal.id && r.reviewer_role !== role);
  return {
    id: deal.id,
    source: deal.source,
    title: deal.title,
    amount: deal.amount === null ? null : Number(deal.amount),
    currency: deal.currency,
    status: deal.status,
    settled_at: deal.settled_at,
    review_closes_at: deal.review_closes_at,
    role,
    counterparty: nameOf(names, counterpartyId),
    myReview: mine ? toReviewView(mine) : null,
    theirReview: theirs ? toReviewView(theirs) : null,
    canReview: !mine && now < new Date(deal.review_closes_at),
  };
}

/**
 * Every deal the signed-in person is a party to, newest first. RLS returns
 * only their own deals, and of the reviews only their own plus revealed ones,
 * so `theirReview` stays null while the deal is still blind.
 */
export async function listMyDeals(
  supabase: AnySupabaseClient,
  myActorIds: string[],
  now: Date = new Date()
): Promise<MyDeal[]> {
  if (myActorIds.length === 0) {
    return [];
  }
  const ids = myActorIds.join(',');
  const { data: deals, error } = (await fromTable(supabase, DATABASE_TABLES.DEALS)
    .select(DEAL_COLUMNS)
    .or(`provider_actor_id.in.(${ids}),customer_actor_id.in.(${ids})`)
    .order('settled_at', { ascending: false })
    .limit(100)) as { data: DealRow[] | null; error: unknown };
  if (error) {
    throw error;
  }
  const rows = deals ?? [];
  if (rows.length === 0) {
    return [];
  }
  const { data: reviews } = (await fromTable(supabase, DATABASE_TABLES.DEAL_REVIEWS)
    .select(REVIEW_COLUMNS)
    .in(
      'deal_id',
      rows.map(d => d.id)
    )) as { data: ReviewRow[] | null };
  const mine = new Set(myActorIds);
  const counterparties = rows.map(d =>
    mine.has(d.customer_actor_id) ? d.provider_actor_id : d.customer_actor_id
  );
  const names = await actorNames(supabase, [...new Set(counterparties)]);
  return rows.map(d => toMyDeal(d, reviews ?? [], mine, names, now));
}

export type CreateDealReviewResult =
  | { ok: true; review: { created_at: string; revealed: boolean } }
  | {
      ok: false;
      code: 'not_found' | 'bad_request' | 'conflict' | 'closed';
      message: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

/** What the database's refusals mean, in words a person can act on. */
export function explainInsertError(error: { code?: string; message?: string }): {
  code: 'conflict' | 'closed' | 'not_found';
  message: string;
} | null {
  if (error.code === '23505') {
    return {
      code: 'conflict',
      message: 'You have already reviewed this deal. A review cannot be changed once written.',
    };
  }
  if (error.message?.includes('review window')) {
    return {
      code: 'closed',
      message: 'The review window for this deal has closed.',
    };
  }
  if (error.message?.includes('Only the two people') || error.message?.includes('No such deal')) {
    return { code: 'not_found', message: 'Deal not found' };
  }
  return null;
}

/**
 * Write the signed-in person's review of one deal. Their side is read from the
 * deal first so the answers can be checked against that side's questions; the
 * database derives it again on insert and refuses anyone who is not a party.
 */
export async function createDealReview(
  supabase: AnySupabaseClient,
  myActorIds: string[],
  dealId: string,
  rawInput: unknown
): Promise<CreateDealReviewResult> {
  const { data: deal } = (await fromTable(supabase, DATABASE_TABLES.DEALS)
    .select(DEAL_COLUMNS)
    .eq('id', dealId)
    .maybeSingle()) as { data: DealRow | null };
  const mine = new Set(myActorIds);
  const reviewerActorId = deal
    ? [deal.customer_actor_id, deal.provider_actor_id].find(id => mine.has(id))
    : undefined;
  if (!deal || !reviewerActorId) {
    return { ok: false, code: 'not_found', message: 'Deal not found' };
  }
  const role: ReviewerRole = reviewerActorId === deal.customer_actor_id ? 'customer' : 'provider';

  const parsed = dealReviewInputSchema(role).safeParse({
    ...(rawInput && typeof rawInput === 'object' ? rawInput : {}),
    deal_id: dealId,
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: 'bad_request',
      message: 'Invalid review',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const body = parsed.data.body ?? null;

  const { data, error } = (await fromTable(supabase, DATABASE_TABLES.DEAL_REVIEWS)
    .insert({
      deal_id: dealId,
      reviewer_actor_id: reviewerActorId,
      // Overwritten by the database from the deal; sent because the columns are NOT NULL.
      subject_actor_id: role === 'customer' ? deal.provider_actor_id : deal.customer_actor_id,
      reviewer_role: role,
      answers: parsed.data.answers,
      body,
      body_sha256: body === null ? null : await sha256Hex(body),
    })
    .select('created_at')
    .single()) as {
    data: { created_at: string } | null;
    error: { code?: string; message?: string } | null;
  };
  if (error || !data) {
    const explained = error ? explainInsertError(error) : null;
    if (explained) {
      return { ok: false, ...explained };
    }
    throw error ?? new Error('Deal review insert returned no row');
  }
  const { data: revealed } = (await callRpc(supabase, 'deal_reviews_revealed', {
    p_deal_id: dealId,
  })) as { data: boolean | null };
  if (!revealed) {
    // Still blind, so the other side has not written yet: tell them they can.
    await notifyCounterpartReviewed(supabase, deal, role);
  }
  return { ok: true, review: { created_at: data.created_at, revealed: Boolean(revealed) } };
}

// ==================== PUBLIC TRACK RECORD ====================

export interface PublicDealReview extends DealReviewView {
  reviewer: ActorName;
}

export interface TrackRecord {
  dealsProvided: number;
  completed: number;
  refunded: number;
  cancelled: number;
  distinctCustomers: number;
  dealsAsCustomer: number;
  btcProvided: number;
  firstDealAt: string | null;
  lastDealAt: string | null;
  /** Of the revealed reviews about this actor that answer the headline question, how many said yes. */
  wouldDealAgain: { yes: number; of: number };
  recentReviews: PublicDealReview[];
}

interface TrackRecordRow {
  deals_provided: number;
  deals_provided_completed: number;
  deals_provided_refunded: number;
  deals_provided_cancelled: number;
  distinct_customers: number;
  deals_as_customer: number;
  btc_provided: number | string;
  first_deal_at: string | null;
  last_deal_at: string | null;
}

const RECENT_REVIEWS = 5;

/**
 * An actor's public track record. Pass a SESSIONLESS client
 * (createPublicClient): with a session, RLS also returns the viewer's own
 * still-blind reviews, and the record would differ by who is looking.
 *
 * Null when the actor has no deals at all — a profile with nothing to show
 * hides the section rather than displaying a row of zeros.
 */
export async function getTrackRecord(
  publicClient: AnySupabaseClient,
  actorId: string
): Promise<TrackRecord | null> {
  const { data: counts, error } = (await callRpc(publicClient, 'actor_track_record', {
    p_actor_id: actorId,
  })) as { data: TrackRecordRow[] | null; error: unknown };
  if (error) {
    throw error;
  }
  const c = counts?.[0];
  if (!c || c.deals_provided + c.deals_as_customer === 0) {
    return null;
  }
  const headline = `answers->>${HEADLINE_QUESTION}`;
  const aboutThem = () =>
    fromTable(publicClient, DATABASE_TABLES.DEAL_REVIEWS)
      .select('deal_id', { count: 'exact', head: true })
      .eq('subject_actor_id', actorId);
  const [answered, yes, latest] = (await Promise.all([
    aboutThem().not(headline, 'is', null),
    aboutThem().eq(headline, 'true'),
    fromTable(publicClient, DATABASE_TABLES.DEAL_REVIEWS)
      .select(REVIEW_COLUMNS)
      .eq('subject_actor_id', actorId)
      .order('created_at', { ascending: false })
      .limit(RECENT_REVIEWS),
  ])) as [{ count: number | null }, { count: number | null }, { data: ReviewRow[] | null }];
  const recent = latest.data ?? [];
  const names = await actorNames(publicClient, [...new Set(recent.map(r => r.reviewer_actor_id))]);
  return {
    dealsProvided: c.deals_provided,
    completed: c.deals_provided_completed,
    refunded: c.deals_provided_refunded,
    cancelled: c.deals_provided_cancelled,
    distinctCustomers: c.distinct_customers,
    dealsAsCustomer: c.deals_as_customer,
    btcProvided: Number(c.btc_provided),
    firstDealAt: c.first_deal_at,
    lastDealAt: c.last_deal_at,
    wouldDealAgain: { yes: yes.count ?? 0, of: answered.count ?? 0 },
    recentReviews: recent.map(r => ({
      ...toReviewView(r),
      reviewer: nameOf(names, r.reviewer_actor_id),
    })),
  };
}
