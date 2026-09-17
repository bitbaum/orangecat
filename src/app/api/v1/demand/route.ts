/**
 * GET /api/v1/demand — the open-market demand feed.
 *
 * The FIND→BUILD wire: Loki reads this so a builder can build for real,
 * current demand (open wishlists + what people search for) and list the result
 * back — at which point the two-sided matcher introduces it to whoever wished
 * for it. Public: returns only already-public wishlists and anonymous search
 * aggregates, so no auth is required (unlike the identity-scoped v1 routes).
 */
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/api/standardResponse';
import { getOpenDemand } from '@/services/platform/demand';
import { logger } from '@/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const raw = Number(new URL(request.url).searchParams.get('limit') ?? 20);
    const limit = Math.min(50, Math.max(1, Number.isFinite(raw) ? raw : 20));
    const demand = await getOpenDemand(createAdminClient(), limit);
    return apiSuccess(demand);
  } catch (err) {
    logger.error('GET /api/v1/demand failed', { err }, 'DemandFeed');
    return apiError('Failed to load demand', 'INTERNAL_ERROR', 500);
  }
}
