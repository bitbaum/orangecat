/**
 * GET /api/discover/counts
 *
 * Public entity counts for the /discover hero + tab badges.
 *
 * These counts used to be queried straight from the browser client, which
 * meant anonymous visitors (blocked from the tables by the DB grants/RLS)
 * saw "0 Projects / 0 People / 0 Finance" while signed-in users saw the real
 * numbers. Counting server-side (admin client, public-only filters — see
 * fetchDiscoverCounts) returns the same real numbers to everyone.
 */
import { getAdminClient } from '@/lib/supabase/admin';
import { fetchDiscoverCounts, type DiscoverCounts } from '@/services/search/discoverCounts';
import { apiSuccess, apiError } from '@/lib/api/standardResponse';
import { logger } from '@/utils/logger';
import { CACHE_PRESETS } from '@/lib/api/cache-policy';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_CONTROL = CACHE_PRESETS.MEDIUM;

let cache: { at: number; counts: DiscoverCounts } | null = null;

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > CACHE_TTL_MS) {
      cache = { at: Date.now(), counts: await fetchDiscoverCounts(getAdminClient()) };
    }
    return apiSuccess(cache.counts, { cache: CACHE_CONTROL });
  } catch (error) {
    logger.error('Error fetching discover counts', error, 'Discover');
    return apiError('Failed to fetch discover counts', 'INTERNAL_ERROR', 500);
  }
}
