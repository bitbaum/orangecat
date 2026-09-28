/**
 * GET /api/civic-split/fund?country=CH&region=Zürich&locality=Witikon
 *
 * The local fund the civic split routes a place's share to, or null. Public:
 * a fund is a public group, and knowing whether one's place has one is the
 * first step to starting it.
 */
import { NextRequest } from 'next/server';
import { apiBadRequest, apiSuccess, handleApiError } from '@/lib/api/standardResponse';
import { applyRateLimitHeaders, createRateLimitResponse, rateLimit } from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { findLocalFund, localFundStartHref } from '@/domain/local-fund/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const limit = await rateLimit(request);
  if (!limit.success) {
    return createRateLimitResponse(limit);
  }
  try {
    const url = new URL(request.url);
    const place = {
      country_code: (url.searchParams.get('country') ?? '').trim().toUpperCase(),
      region: (url.searchParams.get('region') ?? '').trim(),
      locality: (url.searchParams.get('locality') ?? '').trim(),
    };
    if (!/^[A-Z]{2}$/.test(place.country_code) || !place.region || !place.locality) {
      return apiBadRequest('country (two letters), region and locality are required');
    }
    const admin = getAdminClient() as unknown as AnySupabaseClient;
    const fund = await findLocalFund(admin, place);
    const response = apiSuccess(
      { place, fund, start_href: fund ? null : localFundStartHref(place) },
      { cache: 'SHORT' }
    );
    return applyRateLimitHeaders(response, limit);
  } catch (error) {
    return handleApiError(error);
  }
}
