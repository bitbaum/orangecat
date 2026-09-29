/**
 * DELETE USER API
 *
 * POST /api/delete-user — permanently deletes the authenticated user's account.
 * Called by Settings → Delete account (API_ROUTES.DELETE_USER). The endpoint
 * was declared and wired into the UI but never implemented — the button 404'd.
 *
 * Deletes the auth user via the GoTrue admin API (service role). Owned rows
 * keyed to the user id (profile, actors, entities) either cascade via FK or
 * remain orphaned-but-inaccessible; the account itself can no longer sign in.
 */

import {
  apiSuccess,
  apiInternalError,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import { revokeAllConnectedApps } from '@/services/auth/connectedApps';
import { logger } from '@/utils/logger';

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const admin = getAdminClient();

    // The oauth_* rows do not cascade from auth.users. Revoke first, so no app
    // that signed in as this person keeps a session after the person is gone.
    await revokeAllConnectedApps(user.id, { forgetConsents: true });

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      logger.error('Account deletion failed', { userId: user.id, error: error.message }, 'Auth');
      return apiInternalError('Failed to delete account. Please try again.');
    }

    logger.info('Account deleted', { userId: user.id }, 'Auth');
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
});
