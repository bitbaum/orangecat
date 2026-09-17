import { z } from 'zod';
import { fetchUserConversations, openConversation } from '@/features/messaging/service.server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiCreated,
  apiValidationError,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { logger } from '@/utils/logger';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';

// Schema for creating a conversation
const createConversationSchema = z.object({
  participantIds: z.array(z.string().guid()).min(1).max(50), // Max 50 participants for groups
  title: z.string().max(100).optional(),
  initialMessage: z.string().max(1000).optional(),
});

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { user } = req;
    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam || '30', 10) || 30, 100);

    logger.debug('Fetching conversations', { userId: user.id, limit }, 'Messages');
    const conversations = await fetchUserConversations(user.id, limit);
    logger.debug('Returning conversations', { count: conversations.length }, 'Messages');

    return apiSuccess({ conversations });
  } catch (error) {
    logger.error('Messages GET error', { error }, 'Messages');
    return handleApiError(error);
  }
});

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { user } = req;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      const retryAfter = retryAfterSeconds(rl);
      return apiRateLimited('Too many conversation requests. Please slow down.', retryAfter);
    }

    const body = await req.json();
    const validation = createConversationSchema.safeParse(body);

    if (!validation.success) {
      return apiValidationError('Invalid request data', {
        fields: validation.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const { participantIds, title } = validation.data;
    const conversationId = await openConversation(participantIds, title || null);

    return apiCreated({ conversationId });
  } catch (error) {
    logger.error('Messages POST error', { error }, 'Messages');
    return handleApiError(error);
  }
});
