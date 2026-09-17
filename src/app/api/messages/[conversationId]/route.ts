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
import { z } from 'zod';
import { PAGINATION, VALIDATION, MESSAGE_TYPES } from '@/features/messaging/lib';
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

const sendMessageSchema = z.object({
  content: z.string().min(VALIDATION.MESSAGE_MIN_LENGTH).max(VALIDATION.MESSAGE_MAX_LENGTH),
  messageType: z
    .enum([MESSAGE_TYPES.TEXT, MESSAGE_TYPES.IMAGE, MESSAGE_TYPES.FILE, MESSAGE_TYPES.SYSTEM])
    .default(MESSAGE_TYPES.TEXT),
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Echoed back on the stored row so the client retires its optimistic bubble
   *  rather than rendering a duplicate — see features/messaging/lib/threadkit-adapter. */
  clientId: z.string().min(1).max(128).optional(),
  senderActorId: z.string().guid().optional(),
});

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

      const { content, messageType, metadata, clientId, senderActorId } = validation.data;
      const result = await postConversationMessage(conversationId, user.id, {
        content,
        messageType,
        // Server-owned key, applied last so a caller cannot displace it.
        metadata: clientId ? { ...(metadata ?? {}), client_id: clientId } : metadata,
        senderActorId,
      });
      if (!result.ok) {
        return apiForbidden('Not a participant in this conversation');
      }
      return apiCreated({ id: result.id }, { headers: rateLimitHeaders(rateLimitResult) });
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
