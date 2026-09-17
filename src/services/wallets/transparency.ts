/**
 * A transparency score that MEASURES rather than asks.
 *
 * OrangeCat had one before. It was deleted in May 2026 as dead code, and the
 * code is worth remembering: `POST /api/transparency/compute` scored whatever
 * booleans the caller put in the request body, and the profile card that showed
 * the result hard-coded four criteria to `true` ("Default for the platform")
 * and inferred the rest from whether a bio contained the word "contribute" and
 * was longer than fifty characters. It measured profile completeness and called
 * it transparency.
 *
 * The rule this replaces it with: **every term is something the platform can
 * observe about a published ledger.** Nothing is self-reported, nothing is
 * declared, and the components are rendered next to the number — a score whose
 * evidence is not shown is a badge, and a badge is what the old one was.
 *
 * The score is per WALLET, computed from a ledger that is already in hand. That
 * is deliberate: "how transparent is this person" needs a stored history to
 * answer honestly, while "how well is THIS ledger explained" is exactly
 * measurable from the transactions on screen.
 */

import type { PublicLedgerEntry } from '@/services/wallets/publicLedger';

/** A balance older than this is stale — published, but not kept current. */
export const FRESH_WINDOW_DAYS = 30;

/**
 * Weights. Explaining transactions is the larger term because it is the part
 * that takes ongoing effort and is the thing the score exists to encourage:
 * publishing a ledger once is a switch, explaining every entry is a practice.
 */
const WEIGHT_EXPLAINED = 0.7;
const WEIGHT_FRESH = 0.3;

export interface TransparencyScore {
  /** 0–100, or null when there is nothing yet to measure. */
  score: number | null;
  /** Transactions carrying an owner's note. */
  explained: number;
  /** Transactions in the published ledger. */
  total: number;
  /** explained / total, or null when there are no transactions. */
  explainedShare: number | null;
  /** Whether the balance was checked within FRESH_WINDOW_DAYS. Null = never checked. */
  balanceFresh: boolean | null;
}

/**
 * Score a published ledger.
 *
 * Returns `score: null` — not zero — for a ledger with no transactions and no
 * balance check. Nothing has been measured, and a zero would read as a verdict
 * on someone who has simply not received anything yet. That is the same rule
 * the balance itself follows: unchecked is unknown, never zero.
 */
export function scoreLedger(
  entries: PublicLedgerEntry[],
  balanceUpdatedAt: string | null,
  now: Date = new Date()
): TransparencyScore {
  const total = entries.length;
  const explained = entries.filter(e => e.note !== null && e.note.trim() !== '').length;
  const explainedShare = total > 0 ? explained / total : null;

  const balanceFresh = balanceUpdatedAt
    ? now.getTime() - new Date(balanceUpdatedAt).getTime() <=
      FRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000
    : null;

  // Nothing observable yet: no transactions to explain and no balance check.
  if (explainedShare === null && balanceFresh === null) {
    return { score: null, explained, total, explainedShare, balanceFresh };
  }

  // Each term contributes only if it can be measured, and the weights are
  // renormalised over the terms that apply — so a wallet with no transactions
  // yet is not punished for a ratio that does not exist.
  let weighted = 0;
  let available = 0;
  if (explainedShare !== null) {
    weighted += WEIGHT_EXPLAINED * explainedShare;
    available += WEIGHT_EXPLAINED;
  }
  if (balanceFresh !== null) {
    weighted += WEIGHT_FRESH * (balanceFresh ? 1 : 0);
    available += WEIGHT_FRESH;
  }

  return {
    score: Math.round((weighted / available) * 100),
    explained,
    total,
    explainedShare,
    balanceFresh,
  };
}
