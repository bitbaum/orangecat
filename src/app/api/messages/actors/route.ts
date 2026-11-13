/**
 * Messaging Actors API
 *
 * GET /api/messages/actors - Get actors the user can send messages as
 *
 * Returns:
 * - User's personal actor (always)
 * - Group actors (if user is admin/moderator of the group)
 *
 * Thin HTTP layer — actor resolution + DB access live in
 * @/features/messaging/api-helpers.server.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess, handleApiError } from '@/lib/api/standardResponse';
import { logger } from '@/utils/logger';
import { fetchMessagingActors, fetchMessagingAgent } from '@/features/messaging/api-helpers.server';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const [actors, agent] = await Promise.all([
      fetchMessagingActors(req.user.id),
      fetchMessagingAgent(),
    ]);
    // `agent` is the Cat's account: the Messenger marks its messages as an
    // agent's and knows whose answer it is waiting for when it is tagged.
    return apiSuccess({ actors, agent });
  } catch (error) {
    logger.error('Messaging actors API error', { error }, 'MessagingActors');
    return handleApiError(error);
  }
});
