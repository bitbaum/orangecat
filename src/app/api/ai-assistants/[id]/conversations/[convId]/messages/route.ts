/**
 * AI Conversation Messages API
 *
 * POST /api/ai-assistants/[id]/conversations/[convId]/messages
 *
 * Auth → rate limit → validate → delegate to sendAiMessage service.
 * Business logic lives in src/services/ai/sendMessage.ts.
 */

import { NextRequest } from 'next/server';
import {
  apiSuccess,
  apiBadRequest,
  apiNotFound,
  apiInternalError,
  apiServiceUnavailable,
  apiRateLimited,
  apiError,
} from '@/lib/api/standardResponse';
import { applyRateLimitHeaders, rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { logger } from '@/utils/logger';
import { z } from 'zod';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { sendAiMessage } from '@/services/ai/sendMessage';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { AI_MESSAGE_MAX_CHARS } from '@/lib/validation/ai';

interface RouteContext {
  params: Promise<{ id: string; convId: string }>;
}

const sendMessageSchema = z.object({
  content: z.string().min(1).max(AI_MESSAGE_MAX_CHARS),
  model: z.string().optional(),
});

export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id: assistantId, convId } = await context.params;
  const aIdV = getValidationError(validateUUID(assistantId, 'assistant ID'));
  if (aIdV) {
    return aIdV;
  }
  const cIdV = getValidationError(validateUUID(convId, 'conversation ID'));
  if (cIdV) {
    return cIdV;
  }
  try {
    const { user, supabase } = request;

    const rateLimitResult = await rateLimitWriteAsync(user.id);
    if (!rateLimitResult.success) {
      const retryAfter = retryAfterSeconds(rateLimitResult);
      return applyRateLimitHeaders(
        apiRateLimited('Rate limit exceeded', retryAfter),
        rateLimitResult
      );
    }

    const body = await (request as NextRequest).json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest('Validation failed', parsed.error.flatten());
    }

    const result = await sendAiMessage(
      supabase,
      user.id,
      assistantId,
      convId,
      parsed.data.content,
      parsed.data.model
    );

    // Map service errors to HTTP responses
    if ('code' in result) {
      switch (result.code) {
        case 'NOT_FOUND':
          return apiNotFound(result.message);
        case 'ARCHIVED':
          return apiBadRequest('Conversation is archived');
        case 'RATE_LIMITED':
          return apiRateLimited(result.message);
        case 'SERVICE_UNAVAILABLE':
          return apiServiceUnavailable('AI service not configured');
        case 'INSUFFICIENT_CREDITS':
          return apiError('Insufficient credits', 'INSUFFICIENT_CREDITS', 402, {
            currentBalance: result.currentBalance,
            requiredAmount: result.requiredAmount,
            shortfall: result.shortfall,
          });
        case 'AI_ERROR':
          return apiError('Failed to generate AI response', 'AI_ERROR', 502, {
            message: result.message,
          });
        case 'DB_ERROR':
          return apiInternalError(result.message);
      }
    }

    return applyRateLimitHeaders(apiSuccess(result), rateLimitResult);
  } catch (error) {
    logger.error('Send message error', error, 'AIMessagesAPI');
    return apiInternalError();
  }
});
