/**
 * Wallet Transfer API
 *
 * POST /api/wallets/transfer - Transfer between user's wallets
 */

import { logger } from '@/utils/logger';
import {
  apiSuccess,
  apiForbidden,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { walletTransferSchema } from '@/lib/validation/finance';
import { executeWalletTransfer } from '@/domain/wallets/transferService';

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many transfer requests. Please slow down.', retryAfterSeconds(rl));
    }

    const rawBody = await request.json();
    const parseResult = walletTransferSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return apiBadRequest('Invalid input', parseResult.error.issues);
    }
    const body = parseResult.data;

    const result = await executeWalletTransfer(
      supabase,
      user.id,
      body.from_wallet_id,
      body.to_wallet_id,
      body.amount_btc,
      body.note
    );

    if (!result.ok) {
      switch (result.code) {
        case 'INVALID_AMOUNT':
        case 'SAME_WALLET':
          return apiBadRequest(result.message);
        case 'NOT_FOUND':
          return apiNotFound(result.message);
        case 'FORBIDDEN':
          return apiForbidden(result.message);
        case 'INSUFFICIENT_BALANCE':
          return apiBadRequest(result.message);
        case 'TX_ERROR':
          return apiInternalError(result.message);
        case 'UPDATE_ERROR':
          return apiInternalError(result.message);
      }
    }

    return apiSuccess({
      transaction: result.transaction,
      wallets: result.wallets,
      message: result.message,
    });
  } catch (error) {
    logger.error('Unexpected error in wallet transfer', { error });
    return apiInternalError('Internal server error');
  }
});
