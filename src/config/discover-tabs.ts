/**
 * /discover — the words in its URL, the order of its shelf, its copy.
 *
 * The page itself is driven by the search engine (services/search/
 * public-search.ts), which knows every public type. This file only decides
 * how those types are NAMED in a URL and in what order a visitor meets them.
 */

import type { PublicHitType } from '@/services/search/public-search';

/** First-fold copy on /discover. */
export const DISCOVER_HERO = {
  title: 'Discover',
  lede: 'People and the things they make, sell, fund and gather for. Paid directly, in Bitcoin or anything else.',
  searchPlaceholder: 'Search people, projects, things to buy…',
  cta: 'List yours',
} as const;

/**
 * The `?type=` word for each kind of thing. Plural, because these URLs were
 * already shared and linked as `/discover?type=projects` before the page was
 * rebuilt; `people` and `profiles` both mean people.
 */
export const DISCOVER_TYPE_SLUGS: Record<PublicHitType, string> = {
  profile: 'people',
  project: 'projects',
  product: 'products',
  service: 'services',
  cause: 'causes',
  event: 'events',
  loan: 'loans',
  investment: 'investments',
  asset: 'assets',
  group: 'groups',
  circle: 'circles',
  wishlist: 'wishlists',
  research: 'research',
  ai_assistant: 'ai_assistants',
  wallet: 'wallets',
  document: 'documents',
};

const SLUG_ALIASES: Record<string, PublicHitType> = { profiles: 'profile' };

/**
 * The order a visitor meets things on the shelf and in the chips: what people
 * come to back or buy first, the rarer kinds after. Wallets and documents are
 * not public listings and never appear.
 */
export const DISCOVER_ORDER: PublicHitType[] = [
  'project',
  'product',
  'service',
  'event',
  'cause',
  'profile',
  'group',
  'circle',
  'research',
  'wishlist',
  'loan',
  'investment',
  'asset',
  'ai_assistant',
];

/** The type a `?type=` value names, or null for "everything". */
export function typeFromSlug(slug: string | null | undefined): PublicHitType | null {
  const s = (slug ?? '').trim().toLowerCase();
  if (!s || s === 'all') {
    return null;
  }
  const found = (Object.entries(DISCOVER_TYPE_SLUGS) as Array<[PublicHitType, string]>).find(
    ([, value]) => value === s
  );
  const type = found?.[0] ?? SLUG_ALIASES[s] ?? null;
  return type && DISCOVER_ORDER.includes(type) ? type : null;
}

/** Cards per page of a grid; "Show more" adds this many. */
export const DISCOVER_PAGE_SIZE = 24;

/** Cards per rail on the shelf. */
export const DISCOVER_RAIL_SIZE = 8;

/** Rails on the shelf before the rest are offered as chips — enough to browse, few enough to finish. */
export const DISCOVER_MAX_RAILS = 6;

/** Ranked hits fetched for a search; counts per kind come from these. */
export const DISCOVER_SEARCH_DEPTH = 100;
