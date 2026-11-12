/**
 * Contribution terms (SSOT) — what an entity states about how much one payment
 * to it may be, and what that payment is called.
 *
 * Only an investment states terms today: a minimum ticket and an optional
 * maximum, in the investment's own `currency`. Its page printed "Minimum
 * Investment ₿0.001" above a card that opened at 0.0001 BTC and offered CHF 5
 * to 50, in support wording, and the server took any amount. The card, the
 * signed-in dialog and both server paths read the terms from here.
 */

import type { EntityType } from './entity-registry';
import { PAY_MAX_BTC, PAY_MIN_BTC } from './pay';
import { DEFAULT_CONTRIBUTION_BTC } from './payment-presets';

export interface ContributionTerms {
  /** Columns holding the bounds, in the row's own `currency`. */
  minColumn: string;
  maxColumn: string;
  /** What one payment is: "The minimum investment is ₿0.001." */
  noun: string;
  /** What the payer does: "Invest with Bitcoin", "Invest CHF 61.20". */
  verb: string;
}

export const CONTRIBUTION_TERMS: Partial<Record<EntityType, ContributionTerms>> = {
  investment: {
    minColumn: 'minimum_investment',
    maxColumn: 'maximum_investment',
    noun: 'investment',
    verb: 'Invest',
  },
};

/** The stated bounds in BTC; null on a side the entity leaves open. */
export interface ContributionBoundsBtc {
  minBtc: number | null;
  maxBtc: number | null;
}

/**
 * The amount field's range and its opening amount: the stated bounds, inside
 * what a payment can be at all. The usual suggestion opens the field unless the
 * terms rule it out, in which case the nearest bound does.
 */
export function contributionRange(bounds?: ContributionBoundsBtc | null) {
  const minBtc = Math.max(PAY_MIN_BTC, bounds?.minBtc ?? 0);
  const maxBtc = Math.min(PAY_MAX_BTC, bounds?.maxBtc ?? PAY_MAX_BTC);
  const defaultBtc = Math.min(Math.max(DEFAULT_CONTRIBUTION_BTC, minBtc), maxBtc);
  return { minBtc, maxBtc, defaultBtc };
}

/** Half a satoshi: a converted amount that rounds to the bound is the bound. */
const BOUND_TOLERANCE_BTC = 0.5e-8;

/** Which stated bound an amount breaks, if any. */
export function breachedBound(
  amountBtc: number,
  bounds?: ContributionBoundsBtc | null
): 'min' | 'max' | null {
  const minBtc = bounds?.minBtc ?? null;
  const maxBtc = bounds?.maxBtc ?? null;
  if (minBtc !== null && amountBtc + BOUND_TOLERANCE_BTC < minBtc) {
    return 'min';
  }
  if (maxBtc !== null && amountBtc - BOUND_TOLERANCE_BTC > maxBtc) {
    return 'max';
  }
  return null;
}
