/**
 * GET /api/messages/[conversationId]/search?q=… — the messages of a
 * conversation that hold these words, for somebody who is in it.
 *
 * Thin HTTP layer: who may search and how words match live in
 * @/features/messaging/server/search.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess, handleApiError } from '@/lib/api/standardResponse';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { searchConversationMessages } from '@/features/messaging/server/search';
import { logger } from '@/utils/logger';

/** A search is a few words, not a document. */
const QUERY_MAX = 200;

export const GET = withAuth(
  async (
    req: AuthenticatedRequest,
    { params }: { params: Promise<{ conversationId: string }> }
  ) => {
    const { conversationId } = await params;
    const invalid = getValidationError(validateUUID(conversationId, 'conversation ID'));
    if (invalid) {
      return invalid;
    }
    try {
      const query = (new URL(req.url).searchParams.get('q') ?? '').slice(0, QUERY_MAX);
      return apiSuccess(await searchConversationMessages(conversationId, req.user.id, query));
    } catch (error) {
      logger.error(
        'Conversation search error',
        { error, conversationId, userId: req.user.id },
        'Messages'
      );
      return handleApiError(error);
    }
  }
);
