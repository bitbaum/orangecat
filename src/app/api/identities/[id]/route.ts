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

      const result = await deleteIdentity(
        getAdminClient(),
        { userId: req.user.id, sessionMethods: await sessionMethods(req.supabase) },
        id,
        identityId =>
          // The oauth_* rows do not cascade from auth.users (see /api/delete-user).
          revokeAllConnectedApps(identityId, { forgetConsents: true })
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
          return apiInternalError(IDENTITIES_COPY.removeFailed);
      }
    } catch (error) {
      return handleApiError(error);
    }
  }
);
