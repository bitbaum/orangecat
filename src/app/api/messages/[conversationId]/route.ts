/**
 * Conversation Messages API Route
 *
 * GET  /api/messages/[conversationId] - Fetch messages with pagination
 * POST /api/messages/[conversationId] - Send a new message
 *
 * Thin HTTP layer — participant checks, DB access, and orchestration live in
 * @/features/messaging/api-helpers.server.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { PAGINATION } from '@/features/messaging/lib';
import { sendMessageSchema } from '@/features/messaging/lib/send-message-schema';
import { rateLimitAction, rateLimitHeaders, retryAfterSeconds } from '@/lib/rate-limit';
import {
  loadConversationMessages,
  postConversationMessage,
} from '@/features/messaging/api-helpers.server';
import {
  apiSuccess,
  apiCreated,
  apiNotFound,
  apiForbidden,
  apiValidationError,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { logger } from '@/utils/logger';
import { validateUUID, getValidationError } from '@/lib/api/validation';

const SEND_REFUSALS = {
  attachments_not_uploaded: 'A file has not finished uploading. Try again in a moment.',
  attachments_invalid: 'These files cannot be sent with this message.',
  payment_request_invalid: 'That payment request cannot be sent in this conversation.',
} as const;

/** GET - Fetch messages for a conversation with cursor-based pagination */
export const GET = withAuth(
  async (
    req: AuthenticatedRequest,
    { params }: { params: Promise<{ conversationId: string }> }
  ) => {
    const { conversationId } = await params;
    const idValidation = getValidationError(validateUUID(conversationId, 'conversation ID'));
    if (idValidation) {
      return idValidation;
    }
    try {
      const { user } = req;
      const { searchParams } = new URL(req.url);
      const cursor = searchParams.get('cursor');
      const limitParam = searchParams.get('limit');
      const limit = Math.min(
        parseInt(limitParam || String(PAGINATION.MESSAGES_DEFAULT), 10) ||
          PAGINATION.MESSAGES_DEFAULT,
        PAGINATION.MESSAGES_MAX
      );

      const result = await loadConversationMessages(
        conversationId,
        user.id,
        cursor || undefined,
        limit
      );
      if (!result.ok) {
        return result.code === 'forbidden'
          ? apiForbidden('Access denied')
          : apiNotFound('Conversation not found');
      }
      return apiSuccess(result.data);
    } catch (error) {
      logger.error(
        'Messages GET error',
        { error, conversationId, userId: req.user.id },
        'Messages'
      );
      return handleApiError(error);
    }
  }
);

/** POST - Send a new message to the conversation */
export const POST = withAuth(
  async (
    req: AuthenticatedRequest,
    { params }: { params: Promise<{ conversationId: string }> }
  ) => {
    const { conversationId } = await params;
    const idValidation = getValidationError(validateUUID(conversationId, 'conversation ID'));
    if (idValidation) {
      return idValidation;
    }
    try {
      const { user } = req;

      const rateLimitResult = await rateLimitAction('MESSAGE_SEND', user.id);
      if (!rateLimitResult.success) {
        const response = apiRateLimited(
          'Rate limit exceeded. Please slow down.',
          retryAfterSeconds(rateLimitResult)
        );
        Object.entries(rateLimitHeaders(rateLimitResult)).forEach(([k, v]) =>
          response.headers.set(k, v)
        );
        return response;
      }

      const body = await req.json();
      const validation = sendMessageSchema.safeParse(body);
      if (!validation.success) {
        return apiValidationError('Invalid request data', {
          fields: validation.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
      }

      const { content, ...rest } = validation.data;
      const result = await postConversationMessage(conversationId, user.id, {
        content: content.trim(),
        ...rest,
      });
      if (!result.ok) {
        return result.code === 'forbidden'
          ? apiForbidden('Not a participant in this conversation')
          : apiValidationError(SEND_REFUSALS[result.code]);
      }
      return apiCreated(
        { id: result.id, attachments: result.attachments },
        { headers: rateLimitHeaders(rateLimitResult) }
      );
    } catch (error) {
      logger.error(
        'Messages POST error',
        { error, conversationId, userId: req.user.id },
        'Messages'
      );
      return handleApiError(error);
    }
  }
);
