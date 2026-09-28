/**
 * GET /api/civic-split/aggregate?country=CH[&region=Zürich]
 *
 * What the people of each place would choose: the mean declared split per
 * locality, with how many people it rests on. Public and cacheable — this is
 * the number the idea lives or dies by, so anyone may read it, including the
 * Solon map. It reports no place under CIVIC_SPLIT_MIN_GROUP declarations and
 * never a row, which is why it may run on the admin client at all.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiBadRequest, handleApiError } from '@/lib/api/standardResponse';
import { rateLimit, createRateLimitResponse, applyRateLimitHeaders } from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { CIVIC_SPLIT_MIN_GROUP } from '@/config/civic-split';
import { aggregateCivicSplits } from '@/domain/civic-split/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const limit = await rateLimit(request);
  if (!limit.success) {
    return createRateLimitResponse(limit);
  }
  try {
    const url = new URL(request.url);
    const country = (url.searchParams.get('country') ?? '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) {
      return apiBadRequest('country must be a two-letter code, e.g. CH');
    }
    const region = url.searchParams.get('region')?.trim() || undefined;
    const admin = getAdminClient() as unknown as AnySupabaseClient;
    const places = await aggregateCivicSplits(admin, { country_code: country, region });
    const response = apiSuccess(
      { country_code: country, region: region ?? null, min_group: CIVIC_SPLIT_MIN_GROUP, places },
      { cache: 'SHORT' }
    );
    return applyRateLimitHeaders(response, limit);
  } catch (error) {
    return handleApiError(error);
  }
}
