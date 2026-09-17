/**
 * GET /api/social/follow-status/[id] — does the signed-in user follow [id]?
 *
 * WHY THIS EXISTS RATHER THAN REUSING /api/social/following/[id]
 * The Follow button used to answer this by downloading the viewer's following
 * list and searching it. That list is paginated at DEFAULT_PAGE_SIZE (20), so
 * the answer was only correct for the first 20 people you follow: follow a
 * 21st and the button reads "Follow" for someone you already follow, and
 * clicking it returns 409 "Already following this user" — the exact bug that
 * was just fixed, on a delay fuse. Nobody has hit it yet only because the
 * busiest account follows 4 people.
 *
 * "Do I follow X" is a different question from "list who I follow", and it has
 * a different shape: one indexed lookup on (follower_id, following_id), which
 * is the table's unique constraint. It cannot be wrong at any list length.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess, apiInternalError } from '@/lib/api/standardResponse';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  try {
    const { id } = await context.params;

    const idValidation = getValidationError(validateUUID(id, 'user ID'));
    if (idValidation) {
      return idValidation;
    }

    const { supabase, user } = request;

    // head:true — we want existence, not the row.
    const { count, error } = await supabase
      .from(DATABASE_TABLES.FOLLOWS)
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', user.id)
      .eq('following_id', id);

    if (error) {
      logger.error('Failed to read follow status', {
        userId: user.id,
        targetId: id,
        error: error.message,
      });
      return apiInternalError('Failed to read follow status');
    }

    return apiSuccess({ following: (count ?? 0) > 0 });
  } catch (error) {
    logger.error('Unexpected error in GET /api/social/follow-status/[id]', { error });
    return apiInternalError('Internal server error');
  }
});
