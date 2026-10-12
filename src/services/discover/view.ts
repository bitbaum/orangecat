/**
 * What /discover shows, decided on the server from its URL.
 *
 *   no query, no type  → the shelf: what was just listed, then one rail per
 *                        kind of thing, then the rest as chips. It ends.
 *   a type             → that kind, newest first, a page at a time.
 *   a query            → everything public that matches, ranked, with how
 *                        many of each kind matched; a type narrows it.
 *
 * Every mode reads the one search engine (services/search/public-search.ts),
 * so what the ⌘K palette found is what "See all results" shows. The shelf and
 * the counts are the same for every visitor and cached for two minutes.
 */

import { unstable_cache } from 'next/cache';
import {
  DISCOVER_MAX_RAILS,
  DISCOVER_ORDER,
  DISCOVER_PAGE_SIZE,
  DISCOVER_RAIL_SIZE,
  DISCOVER_SEARCH_DEPTH,
} from '@/config/discover-tabs';
import { getAdminClient } from '@/lib/supabase/admin';
import {
  countPublic,
  searchPublic,
  type PublicHit,
  type PublicHitType,
} from '@/services/search/public-search';
import type { DiscoverParams } from './params';

export type TypeCounts = Partial<Record<PublicHitType, number>>;

export interface DiscoverRail {
  type: PublicHitType;
  hits: PublicHit[];
  total: number;
}

export type DiscoverView =
  | {
      mode: 'shelf';
      counts: TypeCounts;
      fresh: PublicHit[];
      rails: DiscoverRail[];
      /** Kinds with listings that did not get a rail. */
      more: PublicHitType[];
    }
  | {
      mode: 'browse';
      counts: TypeCounts;
      type: PublicHitType;
      hits: PublicHit[];
      total: number;
      hasMore: boolean;
    }
  | {
      mode: 'search';
      /** Matches per kind, for this query. */
      counts: TypeCounts;
      hits: PublicHit[];
      total: number;
      hasMore: boolean;
      /** More matched than were fetched; totals are a floor. */
      capped: boolean;
      /** When nothing matched: what was just listed, so the page is never empty. */
      fallback: PublicHit[];
    };

/** The kinds present in `counts`, in the order a visitor meets them. */
export function presentTypes(counts: TypeCounts): PublicHitType[] {
  return DISCOVER_ORDER.filter(type => (counts[type] ?? 0) > 0);
}

/** Newest first across kinds. */
function newest(hits: PublicHit[], n: number): PublicHit[] {
  return [...hits].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, n);
}

/**
 * The shelf from one browse of every kind (up to a rail's worth each). The
 * newest few across all kinds are necessarily inside that set, so "Just
 * listed" needs no second query.
 */
export function buildShelf(hits: PublicHit[], counts: TypeCounts) {
  const byType = new Map<PublicHitType, PublicHit[]>();
  for (const hit of hits) {
    byType.set(hit.type, [...(byType.get(hit.type) ?? []), hit]);
  }
  const types = presentTypes(counts).filter(type => byType.has(type));
  return {
    // Things listed, not people joining: a new account is not a listing,
    // and sign-ups outnumber listings, so they would fill the row.
    fresh: newest(
      hits.filter(hit => hit.type !== 'profile'),
      DISCOVER_RAIL_SIZE
    ),
    rails: types.slice(0, DISCOVER_MAX_RAILS).map(type => ({
      type,
      hits: byType.get(type) ?? [],
      total: counts[type] ?? 0,
    })),
    more: types.slice(DISCOVER_MAX_RAILS),
  };
}

const cachedCounts = unstable_cache(() => countPublic(getAdminClient()), ['discover-counts'], {
  revalidate: 120,
});

const cachedShelfHits = unstable_cache(
  async () =>
    (
      await searchPublic(getAdminClient(), {
        perType: DISCOVER_RAIL_SIZE,
        limit: DISCOVER_RAIL_SIZE * DISCOVER_ORDER.length,
      })
    ).hits,
  ['discover-shelf'],
  { revalidate: 120 }
);

export async function loadDiscoverView({ q, type, page }: DiscoverParams): Promise<DiscoverView> {
  const shown = DISCOVER_PAGE_SIZE * page;

  if (q) {
    const { hits, total } = await searchPublic(getAdminClient(), {
      query: q,
      limit: DISCOVER_SEARCH_DEPTH,
    });
    const counts: TypeCounts = {};
    for (const hit of hits) {
      counts[hit.type] = (counts[hit.type] ?? 0) + 1;
    }
    const matching = type ? hits.filter(hit => hit.type === type) : hits;
    const fallback = hits.length === 0 ? buildShelf(await cachedShelfHits(), {}).fresh : [];
    return {
      mode: 'search',
      counts,
      hits: matching.slice(0, shown),
      total: type ? matching.length : total,
      hasMore: matching.length > shown,
      capped: total > hits.length,
      fallback,
    };
  }

  if (type) {
    const [counts, { hits, total }] = await Promise.all([
      cachedCounts(),
      searchPublic(getAdminClient(), { types: [type], limit: shown }),
    ]);
    return { mode: 'browse', counts, type, hits, total, hasMore: total > hits.length };
  }

  const [counts, hits] = await Promise.all([cachedCounts(), cachedShelfHits()]);
  return { mode: 'shelf', counts, ...buildShelf(hits, counts) };
}
