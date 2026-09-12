/**
 * The /discover URL contract, declared once.
 *
 * This page's filter state was read in `useDiscoverState` and written in
 * `useDiscoverUrlSync`, which meant every default was stated twice — `'recent'`
 * appeared in the reader's whitelist and again in the writer's "omit if equal",
 * `'all'` likewise, and the legacy `search` alias was handled in one half and
 * deleted in the other. The two halves agreed, but nothing made them agree, and
 * the ninth filter param would have had to remember both places.
 *
 * So both directions derive from the table below, and `discoverUrlContract`'s
 * test pins the round trip: anything the writer emits, the reader must read
 * back unchanged. That is the property that was previously only a coincidence.
 *
 * These functions are pure on purpose — the hooks around them are not testable
 * without a router, and this is the part with the rules in it.
 */

import { VALID_TAB_TYPES, type DiscoverTabType } from './discoverConstants';
import type { SortOption } from '@/services/search';

/** Sorts the UI offers. Mirrors `SortOption`; the cast below is checked by it. */
export const VALID_SORTS: readonly SortOption[] = ['recent', 'relevance'];

export const DEFAULT_SORT: SortOption = 'recent';
export const DEFAULT_TAB: DiscoverTabType = 'all';

/**
 * Standardised on `q` (matches the global search handoff and the SEO sitelinks
 * template). `search` is the older spelling: still READ so existing links and
 * bookmarks work, never written, and always cleared so a URL carries one.
 */
export const TEXT_KEY = 'q';
export const LEGACY_TEXT_KEY = 'search';

export interface DiscoverUrlState {
  activeTab: DiscoverTabType;
  searchTerm: string;
  selectedCategories: string[];
  sortBy: SortOption;
  country: string;
  city: string;
  postal: string;
  radiusKm: number;
}

/** Params as Next hands them over: `useSearchParams()` may be null on first render. */
export type DiscoverParams = Pick<URLSearchParams, 'get' | 'toString'> | null | undefined;

function str(params: DiscoverParams, key: string): string {
  return params?.get(key) || '';
}

/**
 * Read the reader's choices out of the URL.
 *
 * A value the page cannot honour is not an error — it is a stale or hand-typed
 * link, and falling back to the default is what a reader expects to see.
 */
export function readDiscoverUrl(params: DiscoverParams): DiscoverUrlState {
  const rawSort = str(params, 'sort');
  const rawTab = str(params, 'type');
  const rawRadius = Number(str(params, 'radius_km'));

  return {
    searchTerm: str(params, TEXT_KEY) || str(params, LEGACY_TEXT_KEY),
    selectedCategories: str(params, 'category')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    sortBy: (VALID_SORTS as readonly string[]).includes(rawSort)
      ? (rawSort as SortOption)
      : DEFAULT_SORT,
    activeTab: (VALID_TAB_TYPES as readonly string[]).includes(rawTab)
      ? (rawTab as DiscoverTabType)
      : DEFAULT_TAB,
    country: str(params, 'country'),
    city: str(params, 'city'),
    postal: str(params, 'postal'),
    // A hand-typed `?radius_km=near` is not a distance. NaN would flow into the
    // search filters, so normalise it here to the same "no radius" 0.
    radiusKm: Number.isFinite(rawRadius) ? rawRadius : 0,
  };
}

/**
 * Write the reader's choices back over the params they arrived with.
 *
 * `current` is COPIED, never rebuilt: params this page knows nothing about — a
 * referrer, a campaign tag, a feature flag — have to survive a filter click.
 * A value equal to the default is omitted, so a shared URL carries what the
 * reader chose rather than a restatement of what they did not.
 */
export function writeDiscoverUrl(current: DiscoverParams, next: DiscoverUrlState): URLSearchParams {
  const out = new URLSearchParams(current?.toString() || '');

  const set = (key: string, value: string | null) => {
    if (!value) out.delete(key);
    else out.set(key, value);
  };

  set('type', next.activeTab === DEFAULT_TAB ? null : next.activeTab);
  set(TEXT_KEY, next.searchTerm || null);
  out.delete(LEGACY_TEXT_KEY);
  set('category', next.selectedCategories.length ? next.selectedCategories.join(',') : null);
  set('sort', next.sortBy === DEFAULT_SORT ? null : next.sortBy);
  set('country', next.country || null);
  set('city', next.city || null);
  set('postal', next.postal || null);
  set('radius_km', next.radiusKm ? String(next.radiusKm) : null);

  return out;
}

/** The path a given state should be at, for comparing against where we are. */
export function discoverUrlFor(current: DiscoverParams, next: DiscoverUrlState): string {
  return `/discover?${writeDiscoverUrl(current, next).toString()}`;
}
