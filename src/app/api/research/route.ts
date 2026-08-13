/**
 * Research API - List and Create
 *
 * GET  /api/research - List research topics
 * POST /api/research - Create a new research entity
 */

import { createServerClient } from '@/lib/supabase/server';
import { researchConfig } from '@/config/entity-configs/research-config';
import {
  apiSuccess,
  handleApiError,
  apiRateLimited,
  handleValidationError,
} from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { compose } from '@/lib/api/compose';
import { withRateLimit } from '@/lib/api/withRateLimit';
import { withRequestId } from '@/lib/api/withRequestId';
import { getPagination, getString } from '@/lib/api/query';
import { applyRateLimitHeaders, rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getCacheControl, calculatePage } from '@/lib/api/helpers';
import { getTableName } from '@/config/entity-registry';
import { getUserActorId } from '@/domain/actors';
import type { ResearchEntityCreate } from '@/types/research';
import { NextRequest } from 'next/server';
import { createResearch } from '@/domain/research/createResearch';
import type { ZodType } from 'zod';

// GET /api/research - List research topics (public, no auth required)
export const GET = compose(
  withRequestId(),
  withRateLimit('read')
)(async (request: NextRequest) => {
  try {
    const supabase = await createServerClient();
    const { limit, offset } = getPagination(request.url, { defaultLimit: 20, maxLimit: 100 });
    const category = getString(request.url, 'category');
    const userId = getString(request.url, 'user_id');
    const field = getString(request.url, 'field');
    const status = getString(request.url, 'status');

    // Resolve userId → actorId so we query by actor_id (the canonical ownership column)
    let actorId: string | null = null;
    if (userId) {
      actorId = await getUserActorId(supabase, userId);
      if (!actorId) {
        return apiSuccess([], {
          page: calculatePage(offset, limit),
          limit,
          total: 0,
          headers: { 'Cache-Control': getCacheControl(true) },
        });
      }
    }

    const tableName = getTableName('research');
    let itemsQuery = supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    let countQuery = supabase.from(tableName).select('*', { count: 'exact', head: true });

    if (actorId) {
      itemsQuery = itemsQuery.eq('actor_id', actorId);
      countQuery = countQuery.eq('actor_id', actorId);
    } else {
      itemsQuery = itemsQuery.eq('is_public', true);
      countQuery = countQuery.eq('is_public', true);
    }

    if (field) {
      itemsQuery = itemsQuery.eq('field', field);
      countQuery = countQuery.eq('field', field);
    }
    if (status) {
      itemsQuery = itemsQuery.eq('status', status);
      countQuery = countQuery.eq('status', status);
    }
    if (category) {
      itemsQuery = itemsQuery.contains('sdg_alignment', [{ goal: category }]);
      countQuery = countQuery.contains('sdg_alignment', [{ goal: category }]);
    }

    const [{ data: items, error: itemsError }, { count, error: countError }] = await Promise.all([
      itemsQuery,
      countQuery,
    ]);

    if (itemsError) {
      throw itemsError;
    }
    if (countError) {
      throw countError;
    }

    return apiSuccess(items || [], {
      page: calculatePage(offset, limit),
      limit,
      total: count || 0,
      headers: { 'Cache-Control': getCacheControl(Boolean(userId)) },
    });
  } catch (error) {
    return handleApiError(error);
  }
});

// POST /api/research - Create new research entity
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many creation requests. Please slow down.', retryAfterSeconds(rl));
    }

    const body = await (request as NextRequest).json();
    const schema = researchConfig.schema as ZodType | undefined;
    let validatedBody = body as ResearchEntityCreate;
    if (schema) {
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return handleValidationError(parsed.error);
      }
      validatedBody = parsed.data as ResearchEntityCreate;
    }

    const { response } = await createResearch(supabase, user.id, validatedBody);
    return applyRateLimitHeaders(response, rl);
  } catch (error) {
    return handleApiError(error);
  }
});
