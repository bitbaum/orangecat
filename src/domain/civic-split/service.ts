/**
 * Civic split — reads and writes for one actor, and the place aggregate.
 *
 * The own-row paths run on the caller's client, so RLS is the boundary. The
 * aggregate runs on the admin client because RLS hides every other person's
 * row by design; what leaves this module is averages over groups of at least
 * CIVIC_SPLIT_MIN_GROUP, never a row.
 */
import { CIVIC_SPLIT_MIN_GROUP, type CivicLevelId } from '@/config/civic-split';
import { DATABASE_TABLES } from '@/config/database-tables';
import { fromTable } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { placeKey, sharesFromRow, type CivicShares, type CivicSplitInput } from './schema';

export interface CivicSplit {
  country_code: string;
  region: string;
  locality: string;
  shares: CivicShares;
  is_public: boolean;
  note: string | null;
  updated_at: string;
}

interface SplitRow {
  country_code: string;
  region: string;
  locality: string;
  share_locality: number;
  share_region: number;
  share_nation: number;
  is_public: boolean;
  note: string | null;
  updated_at: string;
}

const ROW_COLUMNS =
  'country_code, region, locality, share_locality, share_region, share_nation, is_public, note, updated_at';

function toSplit(row: SplitRow): CivicSplit {
  return {
    country_code: row.country_code,
    region: row.region,
    locality: row.locality,
    shares: sharesFromRow(row),
    is_public: row.is_public,
    note: row.note,
    updated_at: row.updated_at,
  };
}

export async function getCivicSplit(
  supabase: AnySupabaseClient,
  actorId: string
): Promise<CivicSplit | null> {
  const { data, error } = (await fromTable(supabase, DATABASE_TABLES.CIVIC_SPLITS)
    .select(ROW_COLUMNS)
    .eq('actor_id', actorId)
    .maybeSingle()) as { data: SplitRow | null; error: { message: string } | null };
  if (error) {
    throw new Error(error.message);
  }
  return data ? toSplit(data) : null;
}

/** One row per actor: the second declaration replaces the first. */
export async function saveCivicSplit(
  supabase: AnySupabaseClient,
  actorId: string,
  input: CivicSplitInput
): Promise<CivicSplit> {
  const { data, error } = (await fromTable(supabase, DATABASE_TABLES.CIVIC_SPLITS)
    .upsert(
      {
        actor_id: actorId,
        country_code: input.country_code,
        region: input.region,
        locality: input.locality,
        share_locality: input.shares.locality,
        share_region: input.shares.region,
        share_nation: input.shares.nation,
        is_public: input.is_public,
        note: input.note,
      },
      { onConflict: 'actor_id' }
    )
    .select(ROW_COLUMNS)
    .single()) as { data: SplitRow | null; error: { message: string } | null };
  if (error || !data) {
    throw new Error(error?.message ?? 'Could not save the split');
  }
  return toSplit(data);
}

export async function deleteCivicSplit(supabase: AnySupabaseClient, actorId: string) {
  const { error } = (await fromTable(supabase, DATABASE_TABLES.CIVIC_SPLITS)
    .delete()
    .eq('actor_id', actorId)) as { error: { message: string } | null };
  if (error) {
    throw new Error(error.message);
  }
}

/** The split a profile page may show: only what its owner made public. */
export async function getPublicCivicSplit(
  supabase: AnySupabaseClient,
  actorId: string
): Promise<Omit<CivicSplit, 'is_public'> | null> {
  const { data } = (await fromTable(supabase, DATABASE_TABLES.CIVIC_SPLITS_PUBLIC)
    .select(
      'country_code, region, locality, share_locality, share_region, share_nation, note, updated_at'
    )
    .eq('actor_id', actorId)
    .maybeSingle()) as { data: Omit<SplitRow, 'is_public'> | null };
  if (!data) {
    return null;
  }
  const { is_public: _omitted, ...rest } = toSplit({ ...data, is_public: true });
  return rest;
}

export interface PlaceAggregate {
  country_code: string;
  region: string;
  locality: string;
  /** People whose declaration is in this average. */
  count: number;
  /** Mean share per level, whole percentages that sum to 100. */
  shares: CivicShares;
}

export interface AggregateQuery {
  country_code: string;
  region?: string;
}

/**
 * Mean split per locality for a country (optionally one region), counting
 * every declaration — public or not — and reporting a place only once it has
 * CIVIC_SPLIT_MIN_GROUP of them. Grouping is done here, not in SQL, because the
 * table is small and the rule (what is safe to show) belongs next to the
 * constant that defines it.
 */
export async function aggregateCivicSplits(
  admin: AnySupabaseClient,
  query: AggregateQuery
): Promise<PlaceAggregate[]> {
  let q = fromTable(admin, DATABASE_TABLES.CIVIC_SPLITS)
    .select(
      'country_code, region, locality, region_key, locality_key, share_locality, share_region, share_nation'
    )
    .eq('country_code', query.country_code.toUpperCase());
  if (query.region) {
    q = q.eq('region_key', placeKey(query.region));
  }
  const { data, error } = (await q) as {
    data: Array<SplitRow & { region_key: string; locality_key: string }> | null;
    error: { message: string } | null;
  };
  if (error) {
    throw new Error(error.message);
  }
  return summarizeByPlace(data ?? []);
}

/** Pure: rows in, k-anonymous place averages out. Exported for tests. */
export function summarizeByPlace(
  rows: Array<{
    country_code: string;
    region: string;
    locality: string;
    region_key: string;
    locality_key: string;
    share_locality: number;
    share_region: number;
    share_nation: number;
  }>,
  minGroup = CIVIC_SPLIT_MIN_GROUP
): PlaceAggregate[] {
  const groups = new Map<string, { first: (typeof rows)[number]; rows: typeof rows }>();
  for (const row of rows) {
    const key = `${row.country_code}|${row.region_key}|${row.locality_key}`;
    const group = groups.get(key);
    if (group) {
      group.rows.push(row);
    } else {
      groups.set(key, { first: row, rows: [row] });
    }
  }
  const out: PlaceAggregate[] = [];
  for (const { first, rows: members } of groups.values()) {
    if (members.length < minGroup) {
      continue;
    }
    const mean = (pick: (r: (typeof rows)[number]) => number) =>
      members.reduce((sum, r) => sum + pick(r), 0) / members.length;
    const raw: CivicShares = {
      locality: mean(r => r.share_locality),
      region: mean(r => r.share_region),
      nation: mean(r => r.share_nation),
    };
    out.push({
      country_code: first.country_code,
      region: first.region,
      locality: first.locality,
      count: members.length,
      shares: roundToTotal(raw),
    });
  }
  return out.sort((a, b) => b.count - a.count || a.locality.localeCompare(b.locality));
}

/** Largest-remainder rounding so the published means still sum to 100. */
export function roundToTotal(shares: CivicShares): CivicShares {
  const ids = Object.keys(shares) as CivicLevelId[];
  const floors = ids.map(id => Math.floor(shares[id]));
  let remainder = 100 - floors.reduce((s, v) => s + v, 0);
  const byFraction = ids
    .map((id, i) => ({ i, frac: shares[id] - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of byFraction) {
    if (remainder <= 0) {
      break;
    }
    floors[i] += 1;
    remainder -= 1;
  }
  return Object.fromEntries(ids.map((id, i) => [id, floors[i]])) as CivicShares;
}
