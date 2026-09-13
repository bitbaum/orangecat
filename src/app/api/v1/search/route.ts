/**
 * GET /api/v1/search?q=...&type=all — public semantic search over the economy.
 *
 * The bridge that lets Loki (or any client) query OrangeCat's economy by
 * MEANING without sharing its vector space: send plain query text, OrangeCat
 * embeds it server-side with its own model, runs the same match_content the Cat
 * uses, and returns meaning-ranked matches (needs, supply, projects, people).
 * Public — searches only already-public entities, so no auth (like /api/v1/demand).
 */
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, apiError } from '@/lib/api/standardResponse';
import { searchPlatform, type SearchType } from '@/services/cat/platform-search';
import { logger } from '@/utils/logger';

const VALID_TYPES: readonly SearchType[] = [
  'all',
  'people',
  'projects',
  'products',
  'services',
  'events',
  'causes',
];

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    if (q.length < 2) {
      return apiError('Query "q" (min 2 chars) is required', 'BAD_REQUEST', 400);
    }
    const typeParam = url.searchParams.get('type') as SearchType | null;
    const type: SearchType =
      typeParam && VALID_TYPES.includes(typeParam) ? typeParam : 'all';

    const results = await searchPlatform(createAdminClient(), q, type);
    return apiSuccess({ query: q, type, results });
  } catch (err) {
    logger.error('GET /api/v1/search failed', { err }, 'EconomySearch');
    return apiError('Search failed', 'INTERNAL_ERROR', 500);
  }
}
