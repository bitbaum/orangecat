/**
 * What a party to a deal sees and may do next (ADR-0010), and how the
 * database's refusals reach a person as sentences.
 */

import {
  explainInsertError,
  toMyDeal,
  type DealRow,
  type ReviewRow,
} from '@/domain/reputation/service';
import type { ActorName } from '@/domain/actors/names';

const ME = 'a0000000-0000-4000-8000-000000000001';
const THEM = 'a0000000-0000-4000-8000-000000000002';
const NOW = new Date('2026-10-05T12:00:00Z');

function deal(overrides: Partial<DealRow> = {}): DealRow {
  return {
    id: 'd0000000-0000-4000-8000-000000000001',
    source: 'orangecat.order',
    title: 'Chair',
    amount: '0.01000000',
    currency: 'BTC',
    status: 'settled',
    settled_at: '2026-10-01T00:00:00Z',
    review_closes_at: '2026-10-31T00:00:00Z',
    provider_actor_id: THEM,
    customer_actor_id: ME,
    ...overrides,
  };
}

function review(overrides: Partial<ReviewRow>): ReviewRow {
  return {
    deal_id: 'd0000000-0000-4000-8000-000000000001',
    reviewer_actor_id: ME,
    subject_actor_id: THEM,
    reviewer_role: 'customer',
    answers: { would_deal_again: true },
    body: null,
    body_sha256: null,
    created_at: '2026-10-02T00:00:00Z',
    ...overrides,
  };
}

const names = new Map<string, ActorName>([
  [THEM, { actor_id: THEM, name: 'Lena', username: 'lena' }],
]);
const mine = new Set([ME]);

describe('toMyDeal', () => {
  it('knows which side I was on and who the other side is', () => {
    const d = toMyDeal(deal(), [], mine, names, NOW);
    expect(d.role).toBe('customer');
    expect(d.counterparty.name).toBe('Lena');
    expect(d.amount).toBe(0.01);
  });

  it('lets me review while the window is open and I have not', () => {
    expect(toMyDeal(deal(), [], mine, names, NOW).canReview).toBe(true);
  });

  it('does not let me review twice', () => {
    const d = toMyDeal(deal(), [review({})], mine, names, NOW);
    expect(d.myReview?.answers).toEqual({ would_deal_again: true });
    expect(d.canReview).toBe(false);
  });

  it('does not let me review after the window closes', () => {
    const d = toMyDeal(deal({ review_closes_at: '2026-10-04T00:00:00Z' }), [], mine, names, NOW);
    expect(d.canReview).toBe(false);
  });

  it("files the other side's review as theirs, not mine", () => {
    const theirs = review({
      reviewer_actor_id: THEM,
      subject_actor_id: ME,
      reviewer_role: 'provider',
    });
    const d = toMyDeal(deal(), [theirs], mine, names, NOW);
    expect(d.myReview).toBeNull();
    expect(d.theirReview?.role).toBe('provider');
    expect(d.canReview).toBe(true);
  });

  it('reads the provider side too', () => {
    const d = toMyDeal(
      deal({ provider_actor_id: ME, customer_actor_id: THEM }),
      [],
      mine,
      names,
      NOW
    );
    expect(d.role).toBe('provider');
  });

  it('keeps a fiat amount null-safe', () => {
    expect(
      toMyDeal(deal({ amount: null, currency: null }), [], mine, names, NOW).amount
    ).toBeNull();
  });
});

describe('explainInsertError', () => {
  it('turns a second review into a sentence', () => {
    expect(explainInsertError({ code: '23505' })?.code).toBe('conflict');
  });

  it('says the window closed', () => {
    expect(
      explainInsertError({ code: '23514', message: 'The review window for this deal has closed.' })
        ?.code
    ).toBe('closed');
  });

  it('hides whether a deal exists from someone who was not in it', () => {
    expect(
      explainInsertError({ code: '23514', message: 'Only the two people in a deal can review it.' })
        ?.code
    ).toBe('not_found');
  });

  it('leaves anything else to the generic handler', () => {
    expect(explainInsertError({ code: '08006', message: 'connection failure' })).toBeNull();
  });
});
