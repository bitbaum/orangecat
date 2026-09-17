/**
 * POST /api/profile-claims/token/[token]/decline — the recipient says no.
 *
 * DELIBERATELY UNAUTHENTICATED. Requiring someone to create an account in
 * order to refuse something they never asked for would make "no" more
 * expensive than "yes", and a consent mechanism that costs more than
 * acceptance is not one. Holding the token is the entire authorisation — it is
 * the same credential that would have let the holder accept instead.
 *
 * Rate-limited by IP like any other anonymous write.
 *
 * Thin HTTP layer — business rules live in @/domain/profileClaims/service.
 */

import { NextRequest } from 'next/server';
import {
  apiSuccess,
  apiNotFound,
  apiConflict,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { retryAfterSeconds, rateLimit } from '@/lib/rate-limit';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { logger } from '@/utils/logger';
import { declineProfileClaim } from '@/domain/profileClaims/service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenValidation = getValidationError(validateUUID(token, 'claim token'));
  if (tokenValidation) {
    return tokenValidation;
  }

  try {
    const rl = await rateLimit(req);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const result = await declineProfileClaim(token);
    if (!result.ok) {
      if ('dbError' in result) {
        return handleApiError(result.dbError);
      }
      if (result.code === 'not_found') {
        return apiNotFound(result.message);
      }
      return apiConflict(result.message);
    }

    return apiSuccess({ declined: true });
  } catch (error) {
    // The token is a credential — it never goes in a log line.
    logger.error('profile-claim decline failed', { error }, 'ProfileClaims');
    return handleApiError(error);
  }
}
