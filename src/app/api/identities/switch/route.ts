/**
 * POST /api/identities/switch — become another identity in the caller's circle.
 *
 * Body: { id }. The service mints a one-time code for the target only if the
 * signed-in user's circle contains it; this route exchanges the code on the
 * caller's own cookie-bound client, which replaces the session in place. The
 * code never leaves the server.
 *
 * Session only by construction: `withAuth` reads the cookie session, so an
 * OAuth access token issued to an app for one identity cannot be turned into a
 * session for another.
 */
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiForbidden,
  apiInternalError,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
  handleApiError,
} from '@/lib/api/standardResponse';
import { getValidationError, validateUUID } from '@/lib/api/validation';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import { IDENTITIES_COPY } from '@/config/identities';
import { mintSwitchCode } from '@/domain/identities/service';
import { logger } from '@/utils/logger';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const rl = await rateLimitWriteAsync(req.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    let body: { id?: unknown };
    try {
      body = await req.json();
    } catch {
      return apiBadRequest('Invalid request body');
    }
    const targetId = typeof body.id === 'string' ? body.id : '';
    const idCheck = getValidationError(validateUUID(targetId, 'identity id'));
    if (idCheck) {
      return idCheck;
    }
    if (targetId === req.user.id) {
      return apiSuccess({ switched: false });
    }

    const minted = await mintSwitchCode(getAdminClient(), req.user.id, targetId);
    if (!minted.ok) {
      // One answer for "not yours" and "does not exist": this must not become
      // a way to ask whether an account id is real.
      if (minted.reason === 'not_in_circle') {
        return apiNotFound('Identity');
      }
      if (minted.reason === 'holder_needs_email') {
        return apiForbidden(IDENTITIES_COPY.needsEmail);
      }
      return apiInternalError(IDENTITIES_COPY.switchFailed);
    }

    const { error } = await req.supabase.auth.verifyOtp({
      email: minted.data.email,
      token: minted.data.code,
      type: 'email',
    });
    if (error) {
      logger.error('Identity switch exchange failed', { code: error.code, targetId }, 'Identities');
      return apiInternalError(IDENTITIES_COPY.switchFailed);
    }

    logger.info('Identity switched', { from: req.user.id, to: targetId }, 'Identities');
    return apiSuccess({ switched: true });
  } catch (error) {
    return handleApiError(error);
  }
});
