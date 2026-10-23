/**
 * POST /api/tips/pay { intentId, statusToken } — pay a pay-page invoice from the
 * signed-in payer's own wallet. Spends only the CALLER's wallet (the session,
 * never the body, says whose), and only the amount already on the intent.
 * Rate-limited as a write: each call really does move funds.
 */

import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { payTipFromWallet } from '@/domain/tips/tip-wallet-pay';
import { logger } from '@/utils/logger';

const bodySchema = z.object({
  intentId: z.string().uuid(),
  statusToken: z.string().min(16).max(200),
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const rl = await rateLimitWriteAsync(request.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many payment attempts. Please slow down.', retryAfterSeconds(rl));
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return apiBadRequest('Invalid request', parsed.error.flatten());
    }

    const result = await payTipFromWallet(
      request.user.id,
      parsed.data.intentId,
      parsed.data.statusToken
    );
    if (!result.ok) {
      // Every failure is something the payer can read and act on, and the
      // reason lets the screen tell a "no" from a "maybe".
      return apiBadRequest(result.message, { reason: result.reason });
    }
    return apiSuccess({ paymentHash: result.paymentHash });
  } catch (error) {
    logger.error('tips/pay failed', { error }, 'Tips');
    return apiInternalError('Could not complete the payment.');
  }
});
