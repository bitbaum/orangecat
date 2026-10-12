/**
 * /discover's URL: `?q=` (what was searched), `?type=` (one kind of thing),
 * `?page=` (how many pages of a grid are shown). Every state is a link, so a
 * search or a "Show more" can be shared, bookmarked and gone back to.
 */

import { ROUTES } from '@/config/routes';
import { DISCOVER_TYPE_SLUGS, typeFromSlug } from '@/config/discover-tabs';
import type { PublicHitType } from '@/services/search/public-search';

export interface DiscoverParams {
  q: string;
  type: PublicHitType | null;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** Longest query worth sending; longer is a paste, not a search. */
const MAX_QUERY = 120;
const MAX_PAGE = 20;

export function parseDiscoverParams(raw: RawParams): DiscoverParams {
  // `search` was the query's name before `q`; old links still carry it.
  const q = (first(raw.q) || first(raw.search)).trim().slice(0, MAX_QUERY);
  const page = Number.parseInt(first(raw.page), 10);
  return {
    q,
    type: typeFromSlug(first(raw.type)),
    page: Number.isFinite(page) ? Math.min(Math.max(page, 1), MAX_PAGE) : 1,
  };
}

export function discoverHref({ q = '', type = null, page = 1 }: Partial<DiscoverParams>): string {
  const params = new URLSearchParams();
  if (q.trim()) {
    params.set('q', q.trim());
  }
  if (type) {
    params.set('type', DISCOVER_TYPE_SLUGS[type]);
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  const query = params.toString();
  return query ? `${ROUTES.DISCOVER}?${query}` : ROUTES.DISCOVER;
}
