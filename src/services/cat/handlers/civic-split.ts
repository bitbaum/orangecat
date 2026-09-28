/**
 * Cat handler for the civic split — "send more of my public money to
 * Witikon" said in chat lands as the same one-row-per-actor declaration the
 * dashboard writes (src/domain/civic-split).
 *
 * Partial instructions are the normal case in conversation ("make it 60% to
 * my locality"), so the handler merges what was said over what is already
 * declared and rebalances the rest, exactly as the sliders do. What it will
 * not do is invent a place: with no split on file, the model has to name the
 * country, region and locality, because guessing someone's home is worse than
 * asking.
 */
import { CIVIC_LEVEL_IDS, CIVIC_SPLIT_DEFAULT, type CivicLevelId } from '@/config/civic-split';
import {
  civicSplitInputSchema,
  rebalanceShares,
  sharesSumToTotal,
  type CivicShares,
} from '@/domain/civic-split/schema';
import { getCivicSplit, saveCivicSplit } from '@/domain/civic-split/service';
import type { ActionHandler } from './types';

const SHARE_PARAM: Record<CivicLevelId, string> = {
  locality: 'locality_share',
  region: 'region_share',
  nation: 'nation_share',
};

function readShare(params: Record<string, unknown>, id: CivicLevelId): number | null {
  const raw = params[SHARE_PARAM[id]];
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * The shares to store: what was said, over what is on file. One stated level
 * rebalances the other two; two or three stated levels must add up on their
 * own (with the third filled in when exactly two are given).
 */
export function mergeShares(
  current: CivicShares,
  stated: Partial<Record<CivicLevelId, number>>
): { ok: true; shares: CivicShares } | { ok: false; error: string } {
  const given = CIVIC_LEVEL_IDS.filter(id => stated[id] !== undefined);
  if (given.length === 0) {
    return { ok: true, shares: current };
  }
  if (given.length === 1) {
    return { ok: true, shares: rebalanceShares(current, given[0], stated[given[0]]!) };
  }
  const next: CivicShares = { ...current };
  for (const id of given) {
    next[id] = stated[id]!;
  }
  if (given.length === 2) {
    const missing = CIVIC_LEVEL_IDS.find(id => stated[id] === undefined)!;
    next[missing] = 100 - given.reduce((sum, id) => sum + stated[id]!, 0);
  }
  if (Object.values(next).some(v => v < 0 || v > 100) || !sharesSumToTotal(next)) {
    return { ok: false, error: 'The shares must be between 0 and 100 and add up to 100.' };
  }
  return { ok: true, shares: next };
}

export const civicSplitHandlers: Record<string, ActionHandler> = {
  set_civic_split: async (supabase, _userId, actorId, params) => {
    const current = await getCivicSplit(supabase, actorId);
    const stated: Partial<Record<CivicLevelId, number>> = {};
    for (const id of CIVIC_LEVEL_IDS) {
      const value = readShare(params, id);
      if (value !== null) {
        stated[id] = value;
      }
    }
    const merged = mergeShares(current?.shares ?? { ...CIVIC_SPLIT_DEFAULT }, stated);
    if (!merged.ok) {
      return { success: false, error: merged.error };
    }

    const text = (key: string) => {
      const v = params[key];
      return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };
    const parsed = civicSplitInputSchema.safeParse({
      country_code: text('country_code') ?? current?.country_code,
      region: text('region') ?? current?.region,
      locality: text('locality') ?? current?.locality,
      shares: merged.shares,
      is_public:
        typeof params.is_public === 'boolean' ? params.is_public : (current?.is_public ?? false),
      note: text('note') ?? current?.note ?? null,
    });
    if (!parsed.success) {
      const missing = parsed.error.issues.map(i => i.path.join('.')).join(', ');
      return {
        success: false,
        error: current
          ? `Could not update the split: ${missing}`
          : `No split on file yet — ask for the country code, region and locality first (${missing})`,
      };
    }

    const saved = await saveCivicSplit(supabase, actorId, parsed.data);
    const line = CIVIC_LEVEL_IDS.map(
      id =>
        `${saved.shares[id]}% ${id === 'nation' ? saved.country_code : id === 'region' ? saved.region : saved.locality}`
    ).join(' · ');
    return {
      success: true,
      data: {
        ...saved,
        displayMessage: `🏛️ Your civic split: ${line}${saved.is_public ? ' (on your profile)' : ''}`,
      },
    };
  },
};
