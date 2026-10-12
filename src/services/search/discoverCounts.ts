/**
 * Public entity counts for /discover (tab badges).
 *
 * Filter shapes mirror discoverGenericFetcher.ts so badge totals match the
 * entity-tab views. Runs on the server (admin client) so anonymous visitors
 * see the same real, public-only-filtered numbers as signed-in users.
 */
import { getTableName } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS, ENTITY_STATUS } from '@/config/database-constants';
import {
  FIXTURE_USERNAME_ILIKE_PATTERNS,
  EXACT_FIXTURE_USERNAMES,
  withoutFixtureTitles,
  type NotFilterable,
} from '@/config/public-directory';
import type { AnySupabaseClient } from '@/lib/supabase/types';

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

export async function fetchDiscoverCounts(supabase: AnySupabaseClient): Promise<DiscoverCounts> {
  const head = (q: unknown) => q as Promise<{ count: number | null }>;
  // Every entity count leaves out self-declared test listings, the same rule
  // the lists apply — otherwise a badge promises a card the tab never shows.
  const entity = <Q extends NotFilterable<Q>>(q: Q, titleColumn = 'title') =>
    head(withoutFixtureTitles(q, titleColumn));

  // Same fixture exclusion the profiles list/search query applies (SSOT:
  // config/public-directory.ts) — kept in sync explicitly so this badge
  // count can't drift from what the People tab actually lists again.
  let profilesQuery = supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('*', { count: 'exact', head: true });
  for (const prefix of FIXTURE_USERNAME_ILIKE_PATTERNS) {
    profilesQuery = profilesQuery.not('username', 'ilike', prefix);
  }
  for (const name of EXACT_FIXTURE_USERNAMES) {
    profilesQuery = profilesQuery.neq('username', name);
  }

  const [
    projectsRes,
    profilesRes,
    loansRes,
    investmentsRes,
    assetsRes,
    causesRes,
    eventsRes,
    productsRes,
    servicesRes,
    groupsRes,
    circlesRes,
    wishlistsRes,
    researchRes,
    aiAssistantsRes,
  ] = await Promise.all([
    entity(
      supabase
        .from(getTableName('project'))
        .select('*', { count: 'exact', head: true })
        .eq('status', ENTITY_STATUS.ACTIVE)
    ),
    head(profilesQuery),
    entity(
      supabase
        .from(getTableName('loan'))
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true)
        .eq('status', ENTITY_STATUS.ACTIVE)
    ),
    entity(
      supabase
        .from(getTableName('investment'))
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true)
    ),
    entity(
      supabase
        .from(getTableName('asset'))
        .select('*', { count: 'exact', head: true })
        // Assets are public when active (status-driven, like products). The
        // public_visibility flag is created false and never set, so gating on it
        // hid every asset — see 20260618000006.
        .eq('status', ENTITY_STATUS.ACTIVE)
    ),
    entity(
      supabase
        .from(getTableName('cause'))
        .select('*', { count: 'exact', head: true })
        .eq('status', STATUS.CAUSES.ACTIVE)
    ),
    entity(
      supabase
        .from(getTableName('event'))
        .select('*', { count: 'exact', head: true })
        .in('status', [STATUS.EVENTS.PUBLISHED, STATUS.EVENTS.OPEN, STATUS.EVENTS.ONGOING])
    ),
    entity(
      supabase
        .from(getTableName('product'))
        .select('*', { count: 'exact', head: true })
        .eq('status', STATUS.PRODUCTS.ACTIVE)
    ),
    entity(
      supabase
        .from(getTableName('service'))
        .select('*', { count: 'exact', head: true })
        .eq('status', STATUS.SERVICES.ACTIVE)
    ),
    entity(
      supabase
        .from(getTableName('group'))
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true),
      'name'
    ),
    entity(
      supabase
        .from(getTableName('circle'))
        .select('*', { count: 'exact', head: true })
        .eq('visibility', 'public')
        .eq('status', ENTITY_STATUS.ACTIVE)
    ),
    entity(
      supabase
        .from(getTableName('wishlist'))
        .select('*', { count: 'exact', head: true })
        .eq('visibility', 'public')
        .eq('is_active', true)
    ),
    entity(
      supabase
        .from(getTableName('research'))
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true)
        .eq('status', ENTITY_STATUS.ACTIVE)
    ),
    entity(
      supabase
        .from(getTableName('ai_assistant'))
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true)
        .eq('status', STATUS.AI_ASSISTANTS.ACTIVE)
    ),
  ]);

  return {
    totalProjectsCount: projectsRes.count ?? 0,
    totalProfilesCount: profilesRes.count ?? 0,
    totalLoansCount: loansRes.count ?? 0,
    totalInvestmentsCount: investmentsRes.count ?? 0,
    totalAssetsCount: assetsRes.count ?? 0,
    totalCausesCount: causesRes.count ?? 0,
    totalEventsCount: eventsRes.count ?? 0,
    totalProductsCount: productsRes.count ?? 0,
    totalServicesCount: servicesRes.count ?? 0,
    totalGroupsCount: groupsRes.count ?? 0,
    totalCirclesCount: circlesRes.count ?? 0,
    totalWishlistsCount: wishlistsRes.count ?? 0,
    totalResearchCount: researchRes.count ?? 0,
    totalAiAssistantsCount: aiAssistantsRes.count ?? 0,
  };
}
