/**
 * A transparency score that measures, rather than asks.
 *
 * The score this replaces was deleted in May 2026, and its failure is the
 * specification for this one: it scored booleans the caller handed it, and the
 * card that displayed it hard-coded four criteria to `true` and inferred the
 * rest from the length of a bio. It measured profile completeness and called it
 * transparency. Every term here is observed from a published ledger.
 */

import { describe, it, expect } from 'vitest';
import { scoreLedger, FRESH_WINDOW_DAYS } from '@/services/wallets/transparency';
import type { PublicLedgerEntry } from '@/services/wallets/publicLedger';

const NOW = new Date('2026-09-17T12:00:00.000Z');
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

function entry(note: string | null, txid = Math.random().toString(16).slice(2)): PublicLedgerEntry {
  return {
    txid,
    netBtc: 0.001,
    direction: 'in',
    confirmed: true,
    blockTime: 1_700_000_000,
    explorerUrl: `https://mempool.space/tx/${txid}`,
    note,
  };
}

describe('scoreLedger', () => {
  it('withholds a score when there is nothing to measure', () => {
    // No transactions and no balance check. A zero here would be a verdict on
    // someone who has simply not received anything yet — the same mistake as
    // rendering an unread balance as 0.00.
    const s = scoreLedger([], null, NOW);
    expect(s.score).toBeNull();
    expect(s.explainedShare).toBeNull();
    expect(s.balanceFresh).toBeNull();
  });

  it('scores a fully explained, current ledger at 100', () => {
    const s = scoreLedger([entry('rent'), entry('server bill')], daysAgo(1), NOW);
    expect(s.score).toBe(100);
    expect(s.explained).toBe(2);
    expect(s.total).toBe(2);
  });

  it('gives no credit for explanation when nothing is explained', () => {
    // Freshness alone is 0.3 of the weight.
    const s = scoreLedger([entry(null), entry(null)], daysAgo(1), NOW);
    expect(s.score).toBe(30);
    expect(s.explainedShare).toBe(0);
  });

  it('halves the explanation term for a half-explained ledger', () => {
    // 0.7 * 0.5 + 0.3 = 0.65
    const s = scoreLedger([entry('paid'), entry(null)], daysAgo(1), NOW);
    expect(s.score).toBe(65);
  });

  it('drops the freshness term when the balance is stale', () => {
    const s = scoreLedger([entry('paid')], daysAgo(FRESH_WINDOW_DAYS + 1), NOW);
    expect(s.balanceFresh).toBe(false);
    expect(s.score).toBe(70);
  });

  it('treats a whitespace note as no explanation at all', () => {
    // Otherwise a space bar earns the same score as an explanation.
    const s = scoreLedger([entry('   ')], daysAgo(1), NOW);
    expect(s.explained).toBe(0);
    expect(s.score).toBe(30);
  });

  it('renormalises over the terms that can be measured', () => {
    // A wallet with a current balance and no transactions yet is not punished
    // for a ratio that does not exist — the explanation term is absent, not zero.
    const s = scoreLedger([], daysAgo(1), NOW);
    expect(s.explainedShare).toBeNull();
    expect(s.score).toBe(100);

    // And the mirror: transactions, all explained, balance never checked.
    const t = scoreLedger([entry('paid')], null, NOW);
    expect(t.balanceFresh).toBeNull();
    expect(t.score).toBe(100);
  });

  it('counts the boundary day as still fresh', () => {
    const s = scoreLedger([entry(null)], daysAgo(FRESH_WINDOW_DAYS), NOW);
    expect(s.balanceFresh).toBe(true);
  });
});
