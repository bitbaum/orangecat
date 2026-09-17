/**
 * AI Assistants API - List and Create
 *
 * GET  /api/ai-assistants - List public or user's AI assistants
 * POST /api/ai-assistants - Create a new AI assistant
 *
 * Thin HTTP layer — business rules live in @/services/ai/assistant-service.
 */

import { NextRequest } from 'next/server';
import { aiAssistantSchema } from '@/lib/validation';
import {
  apiSuccess,
  apiBadRequest,
  handleApiError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { withAuth, withOptionalAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { getPagination, getString } from '@/lib/api/query';
import { applyRateLimitHeaders, rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getCacheControl, calculatePage } from '@/lib/api/helpers';
import { listAssistants, createAssistant } from '@/services/ai/assistant-service';

export const GET = withOptionalAuth(async request => {
  try {
    const { user, supabase } = request;
    const { limit, offset } = getPagination(request.url, { defaultLimit: 20, maxLimit: 100 });
    const userId = getString(request.url, 'user_id');

    const result = await listAssistants(supabase, {
      limit,
      offset,
      category: getString(request.url, 'category'),
      userId,
      searchQuery: getString(request.url, 'q'),
      sortBy: getString(request.url, 'sort') || 'popular',
      viewerId: user?.id,
    });
    if (!result.ok) {
      return handleApiError(result.dbError);
    }

    return apiSuccess(result.data.items, {
      page: calculatePage(offset, limit),
      limit,
      total: result.data.count,
      headers: { 'Cache-Control': getCacheControl(Boolean(userId)) },
    });
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many creation requests. Please slow down.', retryAfterSeconds(rl));
    }

    const parsed = aiAssistantSchema.safeParse(await (request as NextRequest).json());
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid request data');
    }

    const result = await createAssistant(supabase, user.id, parsed.data);
    if (!result.ok) {
      return handleApiError(result.dbError);
    }

    return applyRateLimitHeaders(apiSuccess(result.data, { status: 201 }), rl);
  } catch (error) {
    return handleApiError(error);
  }
});
