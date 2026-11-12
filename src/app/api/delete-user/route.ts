/**
 * DELETE USER API
 *
 * POST /api/delete-user — permanently deletes the authenticated user's account.
 * Called by Settings → Delete account (API_ROUTES.DELETE_USER).
 *
 * Connected apps are revoked first (the oauth_* rows do not cascade from
 * auth.users), for every identity the account holds and for the account. Then
 * deleteAccount() removes the identities and the account in ONE transaction
 * (delete_account, migration 20261112203000): their pages go, records shared
 * with other people stay with them, groups are handed on. If it fails, nothing
 * was removed, and the response says so.
 */

import {
  apiSuccess,
  apiConflict,
  apiInternalError,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import { revokeAllConnectedApps } from '@/services/auth/connectedApps';
import { ACCOUNT_DELETION_COPY } from '@/config/account-deletion';
import { deleteAccount } from '@/domain/actors/deleteAccount';
import { heldIdentityIds } from '@/domain/identities/service';
import { logger } from '@/utils/logger';

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const admin = getAdminClient();

    // Identities this account holds go with it (ADR-0014): nothing but this
    // account can ever enter them. Revoke so no app that signed in as any of
    // them keeps a session once they are gone.
    for (const identityId of await heldIdentityIds(admin, user.id)) {
      await revokeAllConnectedApps(identityId, { forgetConsents: true });
    }
    await revokeAllConnectedApps(user.id, { forgetConsents: true });

    const result = await deleteAccount(admin, user.id);
    if (!result.ok) {
      logger.error(
        'Account deletion failed; nothing was removed',
        { userId: user.id, reason: result.reason, error: result.message },
        'Auth'
      );
      return result.reason === 'unshipped_orders'
        ? apiConflict(ACCOUNT_DELETION_COPY.unshippedOrders)
        : apiInternalError(ACCOUNT_DELETION_COPY.notDeleted);
    }

    logger.info('Account deleted', { userId: user.id }, 'Auth');
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
});
