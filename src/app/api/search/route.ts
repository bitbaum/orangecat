/**
 * GET /api/search?q=…&limit=12&per_type=4 — everything public, typo-tolerant
 * and ranked. The ⌘K palette types into this; Discover calls the same
 * `findPublic` on the server, so the two can never disagree.
 *
 * Public by design: it returns only what public_documents() lists, the same
 * rows anyone can browse on /discover.
 */
import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api/standardResponse';
import { createRateLimitResponse, rateLimitSearch } from '@/lib/rate-limit';
import { findPublic } from '@/services/search/find';
import { logger } from '@/utils/logger';

const MAX_QUERY = 120;
const intParam = (v: string | null, fallback: number, max: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), max) : fallback;
};

export async function GET(request: NextRequest) {
  const limited = await rateLimitSearch(request);
  if (!limited.success) {
    return createRateLimitResponse(limited);
  }
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY);
  if (!q) {
    return apiError('Query "q" is required', 'BAD_REQUEST', 400);
  }
  try {
    const result = await findPublic(q, {
      limit: intParam(url.searchParams.get('limit'), 12, 50),
      perType: intParam(url.searchParams.get('per_type'), 4, 50),
    });
    return apiSuccess(result);
  } catch (error) {
    logger.error('search failed', error, 'Search');
    return apiError('Search is unavailable right now', 'INTERNAL_ERROR', 500);
  }
}
