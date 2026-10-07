/**
 * Who gets asked to review, and when (ADR-0010). Each side is asked at most
 * once per kind, never after it has reviewed, never once the window closed.
 */

import {
  dueNudges,
  nudgeKey,
  nudgeKindAt,
  sideKey,
  type NudgeDeal,
} from '@/domain/reputation/nudges';

const DAY = 24 * 60 * 60 * 1000;
const SETTLED = new Date('2026-10-01T00:00:00Z');
const CLOSES = new Date(SETTLED.getTime() + 30 * DAY);
const at = (days: number) => new Date(SETTLED.getTime() + days * DAY);

function deal(overrides: Partial<NudgeDeal> = {}): NudgeDeal {
  return {
    id: 'd1',
    title: 'Chair',
    status: 'settled',
    settled_at: SETTLED.toISOString(),
    review_closes_at: CLOSES.toISOString(),
    provider_actor_id: 'seller',
    customer_actor_id: 'buyer',
    ...overrides,
  };
}

describe('nudgeKindAt', () => {
  it('waits a few days after payment — the thing may not have arrived', () => {
    expect(nudgeKindAt(deal(), at(1))).toBeNull();
  });

  it('asks once the settling delay has passed', () => {
    expect(nudgeKindAt(deal(), at(4))).toBe('ask');
  });

  it('switches to the last call in the final days', () => {
    expect(nudgeKindAt(deal(), at(27))).toBe('last_call');
  });

  it('says nothing once the window has closed', () => {
    expect(nudgeKindAt(deal(), at(30))).toBeNull();
  });

  it('never asks about a cancelled deal', () => {
    expect(nudgeKindAt(deal({ status: 'cancelled' }), at(4))).toBeNull();
  });
});

describe('dueNudges', () => {
  it('asks both sides when neither has reviewed', () => {
    const due = dueNudges([deal()], new Set(), new Set(), at(4));
    expect(due.map(n => [n.role, n.recipientActorId, n.counterpartyActorId])).toEqual([
      ['customer', 'buyer', 'seller'],
      ['provider', 'seller', 'buyer'],
    ]);
  });

  it('leaves alone a side that has already reviewed', () => {
    const due = dueNudges([deal()], new Set([sideKey('d1', 'customer')]), new Set(), at(4));
    expect(due.map(n => n.role)).toEqual(['provider']);
  });

  it('never sends the same nudge twice', () => {
    const sent = new Set([nudgeKey('d1', 'customer', 'ask'), nudgeKey('d1', 'provider', 'ask')]);
    expect(dueNudges([deal()], new Set(), sent, at(10))).toEqual([]);
  });

  it('still sends the last call after the ask went out', () => {
    const sent = new Set([nudgeKey('d1', 'customer', 'ask')]);
    const due = dueNudges([deal()], new Set(), sent, at(27));
    expect(due.filter(n => n.role === 'customer').map(n => n.kind)).toEqual(['last_call']);
  });
});
