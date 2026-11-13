/**
 * POST /api/ai/images/suggest — royalty-free image suggestions for an article.
 * With an explicit `query`, it just searches; otherwise it asks the AI for
 * concrete search terms from the article, searches the top few, and merges the
 * results. Auth + write-tier rate limit (it makes an LLM + external call).
 */

import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  IMAGE_SEARCH_DOWN_MESSAGE,
  IMAGE_SEARCH_QUERY_MAX,
  IMAGES_PER_QUERY,
} from '@/config/images';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { createRateLimitResponse, rateLimitWriteAsync } from '@/lib/rate-limit';
import {
  apiBadRequest,
  apiInternalError,
  apiServiceUnavailable,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { suggestImageQueries } from '@/services/images/image-suggest';
import { ImageSearchUnavailableError, searchOpenverse } from '@/services/images/openverse';
import type { StockImage } from '@/services/images/types';
import { logger } from '@/utils/logger';

const bodySchema = z.object({
  title: z.string().trim().max(300).optional(),
  body: z.string().trim().max(100_000).optional(),
  /** Explicit search term — skips AI query suggestion. */
  query: z.string().trim().max(IMAGE_SEARCH_QUERY_MAX).optional(),
});

/** How many AI-suggested queries to actually search, and the total image cap. */
const QUERIES_TO_SEARCH = 3;
const MAX_IMAGES = 12;

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return createRateLimitResponse(rl) as NextResponse;
    }

    const parsed = bodySchema.safeParse(await (request as NextRequest).json().catch(() => ({})));
    if (!parsed.success) {
      return apiBadRequest('Invalid request', parsed.error.flatten());
    }
    const { title, body, query } = parsed.data;

    if (!query && !title && !body) {
      return apiBadRequest('Add a title or some body text (or a search term) first.');
    }

    const queries = query ? [query] : await suggestImageQueries(title ?? '', body ?? '');
    if (!queries.length) {
      return apiSuccess({ queries: [], images: [] }) as NextResponse;
    }

    // Search the top few queries and merge, de-duping by image id. One query
    // that did not answer still leaves the others; only when NONE answered is
    // the search down, which is a different thing from "nothing matched".
    const settled = await Promise.allSettled(
      queries.slice(0, QUERIES_TO_SEARCH).map(q => searchOpenverse(q, IMAGES_PER_QUERY))
    );
    const perQuery = settled.flatMap(r => (r.status === 'fulfilled' ? [r.value] : []));
    if (!perQuery.length) {
      const reason = settled[0]?.status === 'rejected' ? settled[0].reason : undefined;
      if (reason instanceof ImageSearchUnavailableError) {
        logger.warn('images/suggest: photo search down', { status: reason.status }, 'ImagesAPI');
        return apiServiceUnavailable(IMAGE_SEARCH_DOWN_MESSAGE) as NextResponse;
      }
      throw reason;
    }
    const seen = new Set<string>();
    const images: StockImage[] = [];
    for (const batch of perQuery) {
      for (const img of batch) {
        if (!seen.has(img.id)) {
          seen.add(img.id);
          images.push(img);
        }
      }
    }

    return apiSuccess({ queries, images: images.slice(0, MAX_IMAGES) }) as NextResponse;
  } catch (error) {
    logger.error('images/suggest failed', error, 'ImagesAPI');
    return apiInternalError('Could not suggest images right now. Please try again.');
  }
});
