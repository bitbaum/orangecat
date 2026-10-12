/**
 * The one search over everything public — the ⌘K palette, /discover and its
 * counts all read it, so a hit in the palette is still there one click later.
 *
 * Backed by the search_public / public_counts RPCs
 * (supabase/migrations/20261012120000_one_search_engine.sql): accent-folded
 * full text, every word matched as a prefix ("lo" finds Loki), typo tolerance
 * ("lokii" finds Loki), and a ranking that puts an exact or leading title
 * match first. An empty query browses instead: everything public, newest first.
 *
 * Fixture patterns travel as RPC arguments from src/config/public-directory.ts,
 * the one list. The two rules SQL cannot express the same way (stamped audit
 * group names, the "User" display name) are applied here to the rows returned.
 */

import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import {
  EXACT_FIXTURE_USERNAMES,
  FIXTURE_TITLE_LIKE_PATTERNS,
  FIXTURE_USERNAME_ILIKE_PATTERNS,
  isFixtureDisplayName,
  isFixtureGroupTitle,
} from '@/config/public-directory';
import { ROUTES } from '@/config/routes';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';

/** Every type the engine returns: the public entity types, plus people. */
export type PublicHitType = EntityType | 'profile';

export interface PublicHit {
  type: PublicHitType;
  id: string;
  title: string;
  snippet: string;
  imageUrl: string | null;
  href: string;
  /** Price, goal or ask, in `currency`. Null when the type has none. */
  amount: number | null;
  currency: string | null;
  /** When an event starts. */
  startsAt: string | null;
  place: string | null;
  createdAt: string | null;
  /** The profile's username, for an "@handle" line. */
  handle: string | null;
  rank: number;
}

export interface PublicSearchPage {
  hits: PublicHit[];
  /** How many rows match in all, before limit and offset. */
  total: number;
}

export interface PublicSearchOptions {
  query?: string;
  types?: PublicHitType[];
  limit?: number;
  offset?: number;
  /** At most this many hits of any one type — keeps one type from filling a list. */
  perType?: number;
}

interface SearchRow {
  entity_type: string;
  id: string;
  title: string | null;
  snippet: string | null;
  image_url: string | null;
  path_key: string | null;
  amount: number | string | null;
  currency: string | null;
  starts_at: string | null;
  place: string | null;
  created_at: string | null;
  rank: number | null;
  total: number | string | null;
}

/** The fixture filters, as the RPCs take them. */
export const FIXTURE_RPC_ARGS = {
  p_exclude_title_like: [...FIXTURE_TITLE_LIKE_PATTERNS],
  p_exclude_handle_ilike: [...FIXTURE_USERNAME_ILIKE_PATTERNS],
  p_exclude_handles: [...EXACT_FIXTURE_USERNAMES],
};

/**
 * Public page for a hit. Every entity type has a `publicBasePath` keyed by id
 * in the registry; two keys are not the id: a profile's username and a
 * group's slug.
 */
export function publicHref(type: string, id: string, pathKey: string | null): string {
  if (type === 'profile') {
    return ROUTES.PROFILES.VIEW(pathKey || id);
  }
  if (type === 'group') {
    return pathKey ? ROUTES.GROUPS.VIEW(pathKey) : ROUTES.GROUPS.LIST;
  }
  const meta = (ENTITY_REGISTRY as Partial<Record<string, { publicBasePath: string }>>)[type];
  return meta ? `${meta.publicBasePath}/${id}` : ROUTES.DISCOVER;
}

function isFixtureHit(row: SearchRow): boolean {
  if (row.entity_type === 'group') {
    return isFixtureGroupTitle(row.title);
  }
  if (row.entity_type === 'profile') {
    return isFixtureDisplayName(row.title);
  }
  return false;
}

function toNumber(value: number | string | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * An image URL a browser can load from any page: absolute http(s), or
 * site-relative. Listings carry whatever their owner typed or an importer
 * wrote ("a.png", "data:…" blobs); anything else is no image, and the card
 * shows its initial instead of breaking.
 */
export function safeImageUrl(url: string | null): string | null {
  const u = (url ?? '').trim();
  return /^https?:\/\//i.test(u) || (u.startsWith('/') && !u.startsWith('//')) ? u : null;
}

export function toPublicHit(row: SearchRow): PublicHit {
  return {
    type: row.entity_type as PublicHitType,
    id: row.id,
    title: row.title ?? '',
    snippet: row.snippet ?? '',
    imageUrl: safeImageUrl(row.image_url),
    href: publicHref(row.entity_type, row.id, row.path_key),
    amount: toNumber(row.amount),
    currency: row.currency,
    startsAt: row.starts_at,
    place: row.place,
    createdAt: row.created_at,
    handle: row.entity_type === 'profile' ? row.path_key : null,
    rank: row.rank ?? 0,
  };
}

/** Search (or, with no query, browse) everything public. Never throws. */
export async function searchPublic(
  client: AnySupabaseClient,
  { query = '', types, limit = 24, offset = 0, perType }: PublicSearchOptions = {}
): Promise<PublicSearchPage> {
  try {
    const { data, error } = await client.rpc('search_public', {
      p_query: query.trim(),
      p_types: types && types.length > 0 ? types : null,
      p_limit: limit,
      p_offset: offset,
      p_per_type: perType ?? null,
      ...FIXTURE_RPC_ARGS,
    } as never);
    if (error) {
      logger.warn('search_public failed', error, 'Search');
      return { hits: [], total: 0 };
    }
    const rows = (data as SearchRow[] | null) ?? [];
    return {
      hits: rows.filter(row => !isFixtureHit(row)).map(toPublicHit),
      total: toNumber(rows[0]?.total ?? 0) ?? 0,
    };
  } catch (error) {
    logger.warn('search_public threw', error, 'Search');
    return { hits: [], total: 0 };
  }
}

/** How many public rows each type has, by the same rules as the search. */
export async function countPublic(
  client: AnySupabaseClient
): Promise<Partial<Record<PublicHitType, number>>> {
  try {
    const { data, error } = await client.rpc('public_counts', FIXTURE_RPC_ARGS as never);
    if (error) {
      logger.warn('public_counts failed', error, 'Search');
      return {};
    }
    const counts: Partial<Record<PublicHitType, number>> = {};
    for (const row of (data as Array<{ entity_type: string; n: number | string }> | null) ?? []) {
      counts[row.entity_type as PublicHitType] = toNumber(row.n) ?? 0;
    }
    return counts;
  } catch (error) {
    logger.warn('public_counts threw', error, 'Search');
    return {};
  }
}
