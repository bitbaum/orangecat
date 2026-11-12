/**
 * DELETE USER API
 *
 * POST /api/delete-user — permanently deletes the authenticated user's account.
 * Called by Settings → Delete account (API_ROUTES.DELETE_USER).
 *
 * Each account (every identity it holds, then itself) goes in two steps:
 *   1. deleteAccountPages() removes every page its actor owns, in one
 *      transaction. Without it GoTrue's delete failed for anyone who owned a
 *      project, product, service, cause or loan (see there for why).
 *   2. GoTrue deletes the auth user (service role), which cascades the profile,
 *      the actor and what hangs off them. Orders and payments with other people
 *      stay in their records; an order's or loan payment's reference to this
 *      person becomes NULL (migration 20261112203000).
 * Step 1 is idempotent, so a retry after step 2 failed finishes the job.
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
import { deleteAccountPages } from '@/domain/actors/deleteAccountPages';
import { heldIdentityIds } from '@/domain/identities/service';
import { logger } from '@/utils/logger';

/** Step 1 then step 2 for one account. Returns the error message, or null. */
async function deleteAccount(
  admin: ReturnType<typeof getAdminClient>,
  userId: string
): Promise<string | null> {
  const pagesError = await deleteAccountPages(admin, userId);
  if (pagesError) {
    return pagesError;
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  return error ? error.message : null;
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const admin = getAdminClient();

    // Identities this account holds go first (ADR-0014). Nothing but this
    // account can ever enter them, so leaving them would strand live pages and
    // wallets with no owner able to sign in. If one cannot be removed, stop:
    // the person can retry, and nothing is half-deleted that they cannot reach.
    for (const identityId of await heldIdentityIds(admin, user.id)) {
      await revokeAllConnectedApps(identityId, { forgetConsents: true });
      const identityError = await deleteAccount(admin, identityId);
      if (identityError) {
        logger.error(
          'Account deletion stopped: an identity could not be deleted',
          { userId: user.id, identityId, error: identityError },
          'Auth'
        );
        return apiInternalError('Failed to delete account. Please try again.');
      }
    }

    // The oauth_* rows do not cascade from auth.users. Revoke first, so no app
    // that signed in as this person keeps a session after the person is gone.
    await revokeAllConnectedApps(user.id, { forgetConsents: true });

    const error = await deleteAccount(admin, user.id);
    if (error) {
      logger.error('Account deletion failed', { userId: user.id, error }, 'Auth');
      return apiInternalError('Failed to delete account. Please try again.');
    }

    logger.info('Account deleted', { userId: user.id }, 'Auth');
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
});
