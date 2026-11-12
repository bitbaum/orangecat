/**
 * DELETE /api/identities/[id] — delete one identity the caller holds, with
 * everything it owns. Never the holder (that is account deletion) and never the
 * identity the caller is signed in as.
 */
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiInternalError,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
  handleApiError,
} from '@/lib/api/standardResponse';
import { getValidationError, validateUUID } from '@/lib/api/validation';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import { sessionMethods } from '@/lib/auth/session-methods';
import { IDENTITIES_COPY } from '@/config/identities';
import { ACCOUNT_DELETION_COPY } from '@/config/account-deletion';
import { deleteAccount } from '@/domain/actors/deleteAccount';
import { deleteIdentity } from '@/domain/identities/service';
import { revokeAllConnectedApps } from '@/services/auth/connectedApps';

export const dynamic = 'force-dynamic';

export const DELETE = withAuth(
  async (req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const rl = await rateLimitWriteAsync(req.user.id);
      if (!rl.success) {
        return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
      }

      const { id } = await context.params;
      const idCheck = getValidationError(validateUUID(id, 'identity id'));
      if (idCheck) {
        return idCheck;
      }

      const admin = getAdminClient();
      const result = await deleteIdentity(
        admin,
        { userId: req.user.id, sessionMethods: await sessionMethods(req.supabase) },
        id,
        async identityId => {
          // The oauth_* rows do not cascade from auth.users (see /api/delete-user).
          await revokeAllConnectedApps(identityId, { forgetConsents: true });
          // One transaction: its pages, its groups handed on, the auth user.
          const removed = await deleteAccount(admin, identityId);
          if (removed.ok) {
            return null;
          }
          return removed.reason === 'unshipped_orders'
            ? ACCOUNT_DELETION_COPY.unshippedOrders
            : IDENTITIES_COPY.removeFailed;
        }
      );
      if (result.ok) {
        return apiSuccess({ deleted: true });
      }
      switch (result.reason) {
        case 'not_in_circle':
          return apiNotFound('Identity');
        case 'is_holder':
          return apiBadRequest('Your main account is deleted from Settings → Delete account.');
        case 'is_current':
          return apiBadRequest(IDENTITIES_COPY.removeCurrent);
        default:
          return apiInternalError(result.message ?? IDENTITIES_COPY.removeFailed);
      }
    } catch (error) {
      return handleApiError(error);
    }
  }
);
