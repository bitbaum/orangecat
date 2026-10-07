/**
 * The review questions are what the database stores and what the track record
 * aggregates. These pin the contract between them (ADR-0010).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEAL_SOURCE_VALUES,
  HEADLINE_QUESTION,
  REVIEW_QUESTIONS,
  REVIEWER_ROLES,
  dealReviewInputSchema,
  reviewAnswersSchema,
} from '@/config/reputation';

const DEAL = '00000000-0000-4000-8000-000000000000';

describe('every side answers the headline question', () => {
  it.each(REVIEWER_ROLES)('%s asks it, and requires it', role => {
    const q = REVIEW_QUESTIONS[role].find(x => x.id === HEADLINE_QUESTION);
    expect(q?.required).toBe(true);
  });

  it('refuses a review without it', () => {
    expect(reviewAnswersSchema('customer').safeParse({ as_described: true }).success).toBe(false);
  });
});

describe('answers', () => {
  it('accepts yes/no and leaves optional questions out', () => {
    expect(reviewAnswersSchema('customer').safeParse({ would_deal_again: false }).success).toBe(
      true
    );
  });

  it('rejects anything that is not a boolean — there are no stars', () => {
    expect(reviewAnswersSchema('customer').safeParse({ would_deal_again: 5 }).success).toBe(false);
  });

  it("rejects the other side's questions instead of silently dropping them", () => {
    const r = reviewAnswersSchema('provider').safeParse({
      would_deal_again: true,
      as_described: true,
    });
    expect(r.success).toBe(false);
  });

  it('question ids are snake_case, so they read the same in SQL and JSON', () => {
    for (const role of REVIEWER_ROLES) {
      for (const q of REVIEW_QUESTIONS[role]) expect(q.id).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });
});

describe('a review as submitted', () => {
  it('trims the body and treats a blank one as invalid rather than empty text', () => {
    const schema = dealReviewInputSchema('customer');
    expect(
      schema.safeParse({ deal_id: DEAL, answers: { would_deal_again: true }, body: '   ' }).success
    ).toBe(false);
    expect(schema.safeParse({ deal_id: DEAL, answers: { would_deal_again: true } }).success).toBe(
      true
    );
  });
});

describe('deal sources match what the database accepts', () => {
  it('every source has the product.kind shape the CHECK enforces', () => {
    for (const s of DEAL_SOURCE_VALUES) expect(s).toMatch(/^[a-z]+\.[a-z_]+$/);
  });

  it('the trigger writes a source that is in the list', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20261005120000_deals_and_deal_reviews.sql'),
      'utf8'
    );
    for (const [, source] of sql.matchAll(/'([a-z]+\.[a-z_]+)'/g)) {
      expect(DEAL_SOURCE_VALUES).toContain(source);
    }
  });
});
