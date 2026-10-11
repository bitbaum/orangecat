import { getAdminClient } from '@/lib/supabase/admin';
import { fetchStudioMapForCat } from '@/services/ai/studio-map-fetcher';
import { fetchDiscoverCounts } from '@/services/search/discoverCounts';
import { logger } from '@/utils/logger';

/**
 * The numbers under the home hero: what is on OrangeCat right now, and how
 * much of the studio behind it is live.
 *
 * Real counts, the same public-only filters /discover uses (so the hero can
 * never claim more than the directory shows), plus the studio's own summary
 * from Loki's fleet map. Nothing here is a marketing figure typed into a
 * config; a number that cannot be fetched is simply not shown.
 *
 * Cached in-process for five minutes, like the discover counts route: the
 * home page is rendered per request (it checks the session) and these
 * fourteen HEAD queries should not run per visitor.
 */

export interface HomePulse {
  /** Projects currently raising on OrangeCat. */
  projects: number;
  /** People with a public profile. */
  people: number;
  /** Products and services on offer. */
  offers: number;
  /** Studio products that are live, from Loki's fleet map; null when unreachable. */
  studioLive: number | null;
  /** Every project in the studio, live or not; null when unreachable. */
  studioProjects: number | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: { at: number; pulse: HomePulse } | null = null;

export async function getHomePulse(now: number = Date.now()): Promise<HomePulse> {
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.pulse;
  }

  const [counts, map] = await Promise.all([
    fetchDiscoverCounts(getAdminClient()).catch((error: unknown) => {
      logger.warn('home pulse: discover counts unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }),
    fetchStudioMapForCat(),
  ]);

  const pulse: HomePulse = {
    projects: counts?.totalProjectsCount ?? 0,
    people: counts?.totalProfilesCount ?? 0,
    offers: (counts?.totalProductsCount ?? 0) + (counts?.totalServicesCount ?? 0),
    studioLive: map?.summary.live ?? null,
    studioProjects: map?.summary.projects ?? null,
  };

  cached = { at: now, pulse };
  return pulse;
}

/** Test seam: forget the cached pulse. */
export function resetHomePulseCache(): void {
  cached = null;
}
