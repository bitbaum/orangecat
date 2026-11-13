/**
 * Contribution terms on the server — the stated minimum and maximum of one
 * payment, converted to BTC for the page and enforced before an invoice is
 * minted, so the bound is not only a number on the screen.
 *
 * Which entities state terms, and in which columns: src/config/contribution-terms.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CONTRIBUTION_TERMS,
  FIAT_BOUND_DRIFT,
  breachedBound,
  isFiatBoundCurrency,
  type ContributionBoundsBtc,
} from '@/config/contribution-terms';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { getAdminClient } from '@/lib/supabase/admin';
import { formatCurrency } from '@/services/currency';
import { convertToBtcOrNull } from '@/services/currency/rates.server';
import { ContributionOutsideTermsError } from './knownPaymentErrors';

interface StatedTerms {
  min: number | null;
  max: number | null;
  currency: string;
}

const positive = (value: unknown): number | null => {
  const n = value === null || value === undefined ? NaN : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function statedTerms(
  entityType: EntityType,
  row: Record<string, unknown> | null
): StatedTerms | null {
  const terms = CONTRIBUTION_TERMS[entityType];
  if (!terms || !row) {
    return null;
  }
  const min = positive(row[terms.minColumn]);
  const max = positive(row[terms.maxColumn]);
  if (min === null && max === null) {
    return null;
  }
  return { min, max, currency: String(row.currency || 'BTC').toUpperCase() };
}

// Refuse rather than guess, as resolveAmount does for a fiat price: a bound
// converted at a made-up rate would refuse or admit the wrong payers.
async function toBtc(amount: number | null, currency: string): Promise<number | null> {
  if (amount === null) {
    return null;
  }
  const btc = await convertToBtcOrNull(amount, currency);
  if (btc === null || !(btc > 0)) {
    throw new Error(
      `Bitcoin exchange rate unavailable for ${currency}; refusing to check the terms`
    );
  }
  return btc;
}

/**
 * The bounds an entity row states, in BTC; null when its type states none or
 * this row leaves both open. Throws when a fiat bound has no rate.
 */
export async function resolveContributionBoundsBtc(
  entityType: EntityType,
  row: Record<string, unknown> | null
): Promise<ContributionBoundsBtc | null> {
  const terms = statedTerms(entityType, row);
  if (!terms) {
    return null;
  }
  return {
    minBtc: await toBtc(terms.min, terms.currency),
    maxBtc: await toBtc(terms.max, terms.currency),
  };
}

/**
 * Refuse an amount outside the bounds the entity states, before anything is
 * minted. A no-op, with no read, for types that state none. Reads through the
 * server's client: the caller has already checked the entity is visible.
 */
export async function assertWithinContributionTerms(
  entityType: EntityType,
  entityId: string,
  amountBtc: number
): Promise<void> {
  const terms = CONTRIBUTION_TERMS[entityType];
  if (!terms) {
    return;
  }
  const admin = getAdminClient() as unknown as SupabaseClient;
  const { data } = await admin
    .from(getEntityMetadata(entityType).tableName)
    .select(`${terms.minColumn}, ${terms.maxColumn}, currency`)
    .eq('id', entityId)
    .maybeSingle();
  const row = data as Record<string, unknown> | null;
  const stated = statedTerms(entityType, row);
  if (!stated) {
    return;
  }
  // The page converted a fiat bound at its own moment's rate; allow the rate to
  // have moved since, so the exact minimum it offered is not refused.
  const breach = breachedBound(
    amountBtc,
    await resolveContributionBoundsBtc(entityType, row),
    isFiatBoundCurrency(stated.currency) ? FIAT_BOUND_DRIFT : 0
  );
  if (breach === 'min' && stated.min !== null) {
    throw new ContributionOutsideTermsError(
      `The minimum ${terms.noun} is ${formatCurrency(stated.min, stated.currency)}.`
    );
  }
  if (breach === 'max' && stated.max !== null) {
    throw new ContributionOutsideTermsError(
      `The maximum ${terms.noun} is ${formatCurrency(stated.max, stated.currency)}.`
    );
  }
}
