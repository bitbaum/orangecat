/**
 * My Cat - Private Chat API
 *
 * POST /api/cat/chat - Ephemeral AI response with model selection
 * - Uses OpenRouter with BYOK if available; otherwise platform key
 * - For non-BYOK users, restricts to free models and checks daily platform usage
 * - Does not persist any conversation content
 *
 * Thin wrapper: auth + rate limit + body validation, then delegates all
 * orchestration (provider resolution, context, memory, tools, streaming,
 * persistence, detached memory extraction) to the chat orchestrator service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { apiBadRequest, apiError, apiInternalError } from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { createRateLimitResponse, rateLimitWriteAsync } from '@/lib/rate-limit';
import {
  orchestrateCatChat,
  catChatBodySchema,
  isAiRateLimitError,
} from '@/services/cat/chat-orchestrator';

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user } = request;
  try {
    // Rate limit (write-tier reused for chat to prevent abuse)
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return createRateLimitResponse(rl) as NextResponse;
    }

    const body = await (request as NextRequest).json();
    const parsed = catChatBodySchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest('Invalid request', parsed.error.flatten());
    }

    return (await orchestrateCatChat(request, parsed.data, rl)) as NextResponse;
  } catch (error) {
    if (isAiRateLimitError(error)) {
      logger.warn(
        'Cat chat rate-limited after fallback (both providers exhausted)',
        { errMsg: error instanceof Error ? error.message : 'unknown' },
        'cat/chat'
      );
      // The AI_RATE_LIMITED code makes the chat (TurnFailure) offer the
      // "Add a free key" link — the actionable path out of this state
      // is to add your own free Groq key, not to wait silently.
      return apiError(
        'The shared free AI quota for Cat is exhausted right now. To keep using Cat without waiting, add your own free Groq API key in Settings → AI (takes ~60s — get one at console.groq.com/keys).',
        'AI_RATE_LIMITED',
        429
      );
    }
    logger.error('Cat chat unhandled error', error, 'CatChatAPI');
    return apiInternalError('An unexpected error occurred. Please try again.');
  }
});
