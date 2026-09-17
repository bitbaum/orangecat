/**
 * GET    /api/profile-claims/[id] — the creator's own view of one claim.
 * DELETE /api/profile-claims/[id] — revoke a still-pending claim (creator only).
 *
 * This route is addressed by the row `id`, which is the CREATOR's handle on
 * their own claim. The public half — preview, claim, decline — lives under
 * `/api/profile-claims/token/[token]` and is addressed by the credential
 * instead. The two were the same value until ADR-0004 D4 split them; keeping
 * both halves on one segment after the split would mean a URL that is
 * sometimes an identifier and sometimes a password.
 *
 * Thin HTTP layer — business rules live in @/domain/profileClaims/service.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiNotFound,
  apiValidationError,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { logger } from '@/utils/logger';
import { getProfileClaimForCreator, revokeProfileClaim } from '@/domain/profileClaims/creator';
import type { ProfileClaimResult } from '@/domain/profileClaims/types';

function toErrorResponse<T>(result: Extract<ProfileClaimResult<T>, { ok: false }>) {
  if ('dbError' in result) {
    return handleApiError(result.dbError);
  }
  if (result.code === 'not_found') {
    return apiNotFound(result.message);
  }
  return apiValidationError(result.message);
}

/**
 * GET /api/profile-claims/[id] — the creator's own view of one claim, for the
 * share screen. Creator-only, and 404s for anyone else: whether a given claim
 * id exists is not a stranger's business.
 *
 * This is NOT the public preview — that lives at
 * /api/profile-claims/token/[token] and is addressed by the credential.
 */
export const GET = withAuth(
  async (req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const idValidation = getValidationError(validateUUID(id, 'claim id'));
    if (idValidation) {
      return idValidation;
    }

    try {
      const result = await getProfileClaimForCreator(id, req.user.id);
      if (!result.ok) {
        return toErrorResponse(result);
      }
      return apiSuccess(result.data);
    } catch (error) {
      logger.error('profile-claim fetch failed', { error, id }, 'ProfileClaims');
      return handleApiError(error);
    }
  }
);

export const DELETE = withAuth(
  async (req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const idValidation = getValidationError(validateUUID(id, 'claim id'));
    if (idValidation) {
      return idValidation;
    }

    try {
      const { user } = req;
      const rl = await rateLimitWriteAsync(user.id);
      if (!rl.success) {
        return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
      }

      const result = await revokeProfileClaim(id, user.id);
      if (!result.ok) {
        return toErrorResponse(result);
      }
      return apiSuccess({ revoked: true });
    } catch (error) {
      logger.error('profile-claim revoke failed', { error, id }, 'ProfileClaims');
      return handleApiError(error);
    }
  }
);
