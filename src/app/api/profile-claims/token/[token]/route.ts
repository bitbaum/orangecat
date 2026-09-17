/**
 * GET /api/profile-claims/token/[token] — public claim preview.
 *
 * No auth: this is what a recipient with no account yet sees before they sign
 * up. Addressed by TOKEN, never by the row id — the id addresses the row for
 * its creator, the token is the credential that travels in a link. Keeping
 * them separate is what lets a claim be referenced publicly later without
 * handing over the ability to take it (ADR-0004 D4).
 *
 * Thin HTTP layer — business rules live in @/domain/profileClaims/service.
 */

import { NextRequest } from 'next/server';
import {
  apiSuccess,
  apiNotFound,
  apiValidationError,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { retryAfterSeconds, rateLimit } from '@/lib/rate-limit';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { logger } from '@/utils/logger';
import { getProfileClaimPreview } from '@/domain/profileClaims/service';
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
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

    const result = await getProfileClaimPreview(token);
    if (!result.ok) {
      return toErrorResponse(result);
    }
    return apiSuccess(result.data);
  } catch (error) {
    // The token is a credential — it never goes in a log line.
    logger.error('profile-claim preview failed', { error }, 'ProfileClaims');
    return handleApiError(error);
  }
}
