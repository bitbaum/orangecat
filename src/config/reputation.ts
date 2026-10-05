/**
 * Reputation — Single Source of Truth (ADR-0010)
 *
 * Which products can record a deal, which questions a deal review asks, and the
 * shape a review must have before it reaches `deal_reviews`.
 *
 * Why there are no stars: a five-point scale drifts until everyone sits at 4.8
 * and the number stops meaning anything. A yes/no question asked of every
 * customer ("would you deal with them again?") keeps its meaning at any volume,
 * and "96% of 41 customers" is a fact a reader can weigh.
 *
 * The database enforces the parts that must never be bypassed: one review per
 * side, only by a party, only while the window is open, never edited, answers
 * are booleans. This file decides WHICH booleans, because that is product
 * judgement and changes more often than a migration should.
 */

import { z } from 'zod';

// ==================== DEAL SOURCES ====================

/**
 * Where a deal can come from, as `product.kind`. OrangeCat is the identity
 * root (ADR-0009), so every product's deals land in one `deals` table keyed by
 * OrangeCat actor ids, and one track record follows a person everywhere.
 *
 * `orangecat.order` is written by a database trigger when an order settles.
 * The others are written by their product through the service role.
 */
export const DEAL_SOURCES = [
  { value: 'orangecat.order', product: 'orangecat', label: 'Order on OrangeCat' },
  { value: 'evig.it_hilfe', product: 'evig', label: 'Technician job on evig' },
  { value: 'loki.crew_assignment', product: 'loki', label: 'Paid assignment via Loki' },
] as const;

export type DealSource = (typeof DEAL_SOURCES)[number]['value'];

export const DEAL_SOURCE_VALUES = DEAL_SOURCES.map(s => s.value) as [DealSource, ...DealSource[]];

// ==================== REVIEW QUESTIONS ====================

/**
 * Which side of the deal the reviewer was on. The database derives it from the
 * deal; nobody chooses it.
 */
export const REVIEWER_ROLES = ['customer', 'provider'] as const;
export type ReviewerRole = (typeof REVIEWER_ROLES)[number];

/**
 * The one question every reviewer answers, on both sides. It is what the public
 * track record aggregates, so it must exist in every question set.
 */
export const HEADLINE_QUESTION = 'would_deal_again' as const;

/**
 * Questions per side. `required: false` means the reviewer may leave it out —
 * "did it arrive on time?" has no answer for a deal with no deadline, and a
 * forced answer to a question that does not apply is noise in the record.
 */
export const REVIEW_QUESTIONS = {
  customer: [
    { id: HEADLINE_QUESTION, label: 'Would you deal with them again?', required: true },
    { id: 'as_described', label: 'Was it what they said it would be?', required: false },
    { id: 'on_time', label: 'Did it arrive or happen when they said?', required: false },
    { id: 'communicated', label: 'Did they answer when you needed them?', required: false },
  ],
  provider: [
    { id: HEADLINE_QUESTION, label: 'Would you deal with them again?', required: true },
    { id: 'clear_request', label: 'Were they clear about what they wanted?', required: false },
    { id: 'communicated', label: 'Did they answer when you needed them?', required: false },
  ],
} as const satisfies Record<
  ReviewerRole,
  readonly { id: string; label: string; required: boolean }[]
>;

export const DEAL_REVIEW_LIMITS = {
  MAX_BODY_LENGTH: 5000,
} as const;

/**
 * The answers a reviewer on `role` may send: only that side's question ids,
 * booleans only, every required question present. Unknown ids are rejected
 * rather than stripped, so a stale client fails loudly instead of losing input.
 */
export function reviewAnswersSchema(role: ReviewerRole) {
  const shape = Object.fromEntries(
    REVIEW_QUESTIONS[role].map(q => [q.id, q.required ? z.boolean() : z.boolean().optional()])
  );
  return z.strictObject(shape);
}

/**
 * A deal review as a person submits it. `role` is what the client believes its
 * side to be; the database derives the real one from the deal and refuses a
 * reviewer who is not a party, so a wrong belief fails rather than misfiles.
 */
export function dealReviewInputSchema(role: ReviewerRole) {
  return z.object({
    deal_id: z.uuid(),
    answers: reviewAnswersSchema(role),
    body: z.string().trim().min(1).max(DEAL_REVIEW_LIMITS.MAX_BODY_LENGTH).optional(),
  });
}

export type DealReviewInput = z.infer<ReturnType<typeof dealReviewInputSchema>>;
