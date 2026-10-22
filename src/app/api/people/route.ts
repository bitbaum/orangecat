/**
 * GET /api/people?q=…&limit=8 — people the signed-in person can pay or ask.
 *
 * Empty q: their circle. Otherwise the circle and every account with a
 * handle, ranked by what was typed (src/domain/people/findPeople.ts).
 */
import type { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { apiError, apiSuccess } from '@/lib/api/standardResponse';
import { createRateLimitResponse, rateLimitSearch } from '@/lib/rate-limit';
import { PEOPLE_FIND_LIMIT } from '@/config/people';
import { findPeople } from '@/domain/people/findPeople';
import { logger } from '@/utils/logger';

const MAX_QUERY = 80;
const MAX_LIMIT = 20;

export const GET = withAuth(async req => {
  const limited = await rateLimitSearch(req);
  if (!limited.success) {
    return createRateLimitResponse(limited) as NextResponse;
  }
  const url = new URL(req.url);
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY);
  const parsed = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 1), MAX_LIMIT)
    : PEOPLE_FIND_LIMIT;
  try {
    const people = await findPeople(req.supabase, req.user.id, query, limit);
    return apiSuccess({ query, people });
  } catch (error) {
    logger.error('people finder failed', error, 'People');
    return apiError('Could not look people up right now', 'INTERNAL_ERROR', 500);
  }
});
