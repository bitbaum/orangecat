/**
 * Public economy search shared with Cat: ranked lexical results, typo
 * correction, and optional semantic candidates checked against current public rows.
 */
import { createRateLimitResponse, rateLimitSearch } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/api/standardResponse';
import { searchPlatform, SEARCH_TYPES, type SearchType } from '@/services/cat/platform-search';
import { logger } from '@/utils/logger';

const VALID_TYPES: readonly SearchType[] = SEARCH_TYPES;

export async function GET(request: NextRequest) {
  const limited = await rateLimitSearch(request);
  if (!limited.success) {
    return createRateLimitResponse(limited);
  }
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
    if (q.length < 2) {
      return apiError('Query "q" (min 2 chars) is required', 'BAD_REQUEST', 400);
    }
    const typeParam = url.searchParams.get('type') as SearchType | null;
    if (typeParam && !VALID_TYPES.includes(typeParam)) {
      return apiError('Unknown public search type', 'BAD_REQUEST', 400);
    }
    const type: SearchType = typeParam ?? 'all';

    const results = await searchPlatform(createAdminClient(), q, type);
    return apiSuccess({ query: q, type, results });
  } catch (err) {
    logger.error('GET /api/v1/search failed', { err }, 'EconomySearch');
    return apiError('Search failed', 'INTERNAL_ERROR', 500);
  }
}
