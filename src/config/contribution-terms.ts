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
 * what a payment can be at all. The field opens empty unless the terms state a
 * minimum, in which case it opens there (the screen rounds that up to a whole
 * unit of the payer's currency: useOpeningAmountBtc).
 */
export function contributionRange(bounds?: ContributionBoundsBtc | null) {
  const minBtc = Math.max(PAY_MIN_BTC, bounds?.minBtc ?? 0);
  const maxBtc = Math.min(PAY_MAX_BTC, bounds?.maxBtc ?? PAY_MAX_BTC);
  const defaultBtc = bounds?.minBtc ? Math.min(minBtc, maxBtc) : DEFAULT_CONTRIBUTION_BTC;
  // A stated minimum above what one payment can be (PAY_MAX_BTC) cannot be met
  // online at all; the card says so instead of offering a field it refuses.
  const unpayable = minBtc > maxBtc;
  return { minBtc, maxBtc, defaultBtc, unpayable };
}

/** Half a satoshi: a converted amount that rounds to the bound is the bound. */
const BOUND_TOLERANCE_BTC = 0.5e-8;

/**
 * How far the Bitcoin rate may move between the page converting a fiat bound
 * and the server converting it again. A payer who pays exactly the CHF 100
 * minimum the page offered is not refused because the rate moved 0.1% while
 * they read the terms. Bounds stated in BTC or SATS need none.
 */
export const FIAT_BOUND_DRIFT = 0.02;

/** Which stated bound an amount breaks, if any. `drift` widens both bounds by that share. */
export function breachedBound(
  amountBtc: number,
  bounds?: ContributionBoundsBtc | null,
  drift = 0
): 'min' | 'max' | null {
  const minBtc = bounds?.minBtc ?? null;
  const maxBtc = bounds?.maxBtc ?? null;
  if (minBtc !== null && amountBtc + BOUND_TOLERANCE_BTC < minBtc * (1 - drift)) {
    return 'min';
  }
  if (maxBtc !== null && amountBtc - BOUND_TOLERANCE_BTC > maxBtc * (1 + drift)) {
    return 'max';
  }
  return null;
}

/** Whether a stated currency is fiat, whose BTC value moves with the rate. */
export function isFiatBoundCurrency(currency: string): boolean {
  const c = currency.toUpperCase();
  return c !== 'BTC' && c !== 'SATS';
}
