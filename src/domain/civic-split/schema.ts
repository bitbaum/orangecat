/**
 * What a civic split IS, as data: the place a person belongs to and three
 * whole percentages that sum to 100. Pure — the service does the I/O.
 */
import { z } from 'zod';
import {
  CIVIC_LEVEL_IDS,
  CIVIC_SPLIT_LIMITS,
  CIVIC_SPLIT_TOTAL,
  type CivicLevelId,
} from '@/config/civic-split';

export type CivicShares = Record<CivicLevelId, number>;

const share = z.coerce.number().int().min(0).max(CIVIC_SPLIT_TOTAL);

const placeName = z
  .string()
  .trim()
  .min(1, 'Name the place')
  .max(CIVIC_SPLIT_LIMITS.placeName, `Keep it under ${CIVIC_SPLIT_LIMITS.placeName} characters`);

export const civicSplitInputSchema = z
  .object({
    country_code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'Two-letter country code, e.g. CH'),
    region: placeName,
    locality: placeName,
    shares: z.object({
      locality: share,
      region: share,
      nation: share,
    }),
    is_public: z.boolean().default(false),
    note: z
      .string()
      .trim()
      .max(CIVIC_SPLIT_LIMITS.note, `Keep the note under ${CIVIC_SPLIT_LIMITS.note} characters`)
      .optional()
      .nullable()
      .transform(v => (v ? v : null)),
  })
  .refine(v => sharesSumToTotal(v.shares), {
    message: `The three shares must add up to ${CIVIC_SPLIT_TOTAL}`,
    path: ['shares'],
  });

export type CivicSplitInput = z.infer<typeof civicSplitInputSchema>;

export function sharesSumToTotal(shares: CivicShares): boolean {
  return CIVIC_LEVEL_IDS.reduce((sum, id) => sum + shares[id], 0) === CIVIC_SPLIT_TOTAL;
}

/**
 * Move one level to `value` and take the difference from the others,
 * proportionally, so the three keep summing to 100 — the slider behaviour.
 * Rounding is settled on the last other level, so the result is exact.
 */
export function rebalanceShares(
  shares: CivicShares,
  changed: CivicLevelId,
  value: number
): CivicShares {
  const target = Math.max(0, Math.min(CIVIC_SPLIT_TOTAL, Math.round(value)));
  const others = CIVIC_LEVEL_IDS.filter(id => id !== changed);
  const remaining = CIVIC_SPLIT_TOTAL - target;
  const othersTotal = others.reduce((sum, id) => sum + shares[id], 0);
  const next: CivicShares = { ...shares, [changed]: target };
  let handed = 0;
  others.forEach((id, i) => {
    const isLast = i === others.length - 1;
    const portion = isLast
      ? remaining - handed
      : othersTotal === 0
        ? Math.floor(remaining / others.length)
        : Math.round((shares[id] / othersTotal) * remaining);
    next[id] = Math.max(0, Math.min(CIVIC_SPLIT_TOTAL, portion));
    handed += next[id];
  });
  // Clamping can leave a remainder; the changed level absorbs it so the
  // invariant holds even at the edges.
  const drift = CIVIC_SPLIT_TOTAL - CIVIC_LEVEL_IDS.reduce((sum, id) => sum + next[id], 0);
  next[changed] += drift;
  return next;
}

/** The grouping key the aggregate uses — same rule as the column's expression. */
export function placeKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Reads a stored row's three columns back into the shape the UI uses. */
export function sharesFromRow(row: {
  share_locality: number;
  share_region: number;
  share_nation: number;
}): CivicShares {
  return {
    locality: row.share_locality,
    region: row.share_region,
    nation: row.share_nation,
  };
}
