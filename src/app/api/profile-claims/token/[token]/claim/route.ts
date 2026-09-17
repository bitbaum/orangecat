/**
 * POST /api/profile-claims/token/[token]/claim — claim a pre-drafted profile.
 *
 * Authenticated: the caller must already have (or have just created) their own
 * OrangeCat account, because the draft is copied onto their own profile row —
 * and `profiles.id` is a validated FK to `auth.users(id)`, so there is nowhere
 * to put it before the account exists.
 *
 * Thin HTTP layer — business rules live in @/domain/profileClaims/service.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiNotFound,
  apiConflict,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { logger } from '@/utils/logger';
import { claimProfileClaim } from '@/domain/profileClaims/service';

export const POST = withAuth(
  async (req: AuthenticatedRequest, { params }: { params: Promise<{ token: string }> }) => {
    const { token } = await params;
    const tokenValidation = getValidationError(validateUUID(token, 'claim token'));
    if (tokenValidation) {
      return tokenValidation;
    }

    try {
      const { user, supabase } = req;
      const rl = await rateLimitWriteAsync(user.id);
      if (!rl.success) {
        return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
      }

      const result = await claimProfileClaim({
        claimToken: token,
        userId: user.id,
        userSupabase: supabase,
      });

      if (!result.ok) {
        if ('dbError' in result) {
          return handleApiError(result.dbError);
        }
        if (result.code === 'not_found') {
          return apiNotFound(result.message);
        }
        // expired / already_claimed / revoked / declined — the link is
        // understood, it is just no longer usable.
        return apiConflict(result.message);
      }

      return apiSuccess({ username: result.data.username });
    } catch (error) {
      // The token is a credential — it never goes in a log line.
      logger.error('profile-claim claim failed', { error }, 'ProfileClaims');
      return handleApiError(error);
    }
  }
);
