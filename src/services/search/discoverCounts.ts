/**
 * Public entity counts for /discover's chips, the home pulse and
 * /api/discover/counts.
 *
 * Read from public_counts(), which counts the same rows search_public()
 * returns (see services/search/public-search.ts) — so a chip can never promise
 * a card the list does not show. This used to be fourteen hand-written count
 * queries whose public rules had already drifted from the lists they badged
 * (projects counted active only while the list showed paused ones too).
 */
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { countPublic, type PublicHitType } from './public-search';

export interface DiscoverCounts {
  totalProjectsCount: number;
  totalProfilesCount: number;
  totalLoansCount: number;
  totalInvestmentsCount: number;
  totalAssetsCount: number;
  totalCausesCount: number;
  totalEventsCount: number;
  totalProductsCount: number;
  totalServicesCount: number;
  totalGroupsCount: number;
  totalCirclesCount: number;
  totalWishlistsCount: number;
  totalResearchCount: number;
  totalAiAssistantsCount: number;
}

export const ZERO_DISCOVER_COUNTS: DiscoverCounts = {
  totalProjectsCount: 0,
  totalProfilesCount: 0,
  totalLoansCount: 0,
  totalInvestmentsCount: 0,
  totalAssetsCount: 0,
  totalCausesCount: 0,
  totalEventsCount: 0,
  totalProductsCount: 0,
  totalServicesCount: 0,
  totalGroupsCount: 0,
  totalCirclesCount: 0,
  totalWishlistsCount: 0,
  totalResearchCount: 0,
  totalAiAssistantsCount: 0,
};

/** Which count field each engine type fills. */
const COUNT_FIELD: Record<Exclude<PublicHitType, 'wallet' | 'document'>, keyof DiscoverCounts> = {
  profile: 'totalProfilesCount',
  project: 'totalProjectsCount',
  loan: 'totalLoansCount',
  investment: 'totalInvestmentsCount',
  asset: 'totalAssetsCount',
  cause: 'totalCausesCount',
  event: 'totalEventsCount',
  product: 'totalProductsCount',
  service: 'totalServicesCount',
  group: 'totalGroupsCount',
  circle: 'totalCirclesCount',
  wishlist: 'totalWishlistsCount',
  research: 'totalResearchCount',
  ai_assistant: 'totalAiAssistantsCount',
};

export async function fetchDiscoverCounts(supabase: AnySupabaseClient): Promise<DiscoverCounts> {
  const byType = await countPublic(supabase);
  const counts: DiscoverCounts = { ...ZERO_DISCOVER_COUNTS };
  for (const [type, field] of Object.entries(COUNT_FIELD)) {
    counts[field] = byType[type as PublicHitType] ?? 0;
  }
  return counts;
}
