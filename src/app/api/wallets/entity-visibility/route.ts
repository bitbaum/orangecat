/**
 * Wallet-entity funding visibility API
 *
 * PATCH /api/wallets/entity-visibility — set the transparency level of a
 * wallet-entity link (private | total | public).
 *
 * Ownership is enforced by RLS: the "Wallet owners can update links" policy
 * only permits the update when the wallet's profile_id = auth.uid(). The
 * update touching zero rows therefore means the caller does not own the wallet
 * (or the link does not exist) → 404.
 */

import { logger } from '@/utils/logger';
import {
  apiSuccess,
  apiBadRequest,
  apiNotFound,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { walletVisibilitySchema } from '@/lib/validation/finance';
import { DATABASE_TABLES } from '@/config/database-tables';

export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const parsed = walletVisibilitySchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiBadRequest('Invalid input', parsed.error.issues);
    }
    const { wallet_id, entity_type, entity_id, visibility } = parsed.data;

    // RLS scopes this to links whose wallet the caller owns.
    const { data, error } = await supabase
      .from(DATABASE_TABLES.ENTITY_WALLETS)
      .update({ visibility })
      .eq('wallet_id', wallet_id)
      .eq('entity_type', entity_type)
      .eq('entity_id', entity_id)
      .select('id, visibility');

    if (error) {
      logger.error('Failed to update wallet-entity visibility', {
        userId: user.id,
        wallet_id,
        entity_type,
        entity_id,
        error,
      });
      return apiInternalError('Failed to update visibility');
    }

    // Zero rows updated → caller does not own the wallet or the link is missing.
    if (!data || data.length === 0) {
      return apiNotFound('Wallet link');
    }

    return apiSuccess({ data: data[0] });
  } catch (err) {
    logger.error('Unexpected error updating wallet-entity visibility', { error: err });
    return apiInternalError('Failed to update visibility');
  }
});
