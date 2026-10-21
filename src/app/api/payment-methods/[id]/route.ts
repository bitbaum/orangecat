/**
 * DELETE /api/payment-methods/[id] — remove one way to be paid.
 * RLS scopes the delete; someone else's id simply matches nothing.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiInternalError,
  apiNotFound,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { removePaymentMethod } from '@/domain/payments/paymentMethodsService';
import { logger } from '@/utils/logger';

export const DELETE = withAuth(
  async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
    try {
      const { user, supabase } = request;

      const rl = await rateLimitWriteAsync(user.id);
      if (!rl.success) {
        return apiRateLimited('Too many changes. Please slow down.', retryAfterSeconds(rl));
      }

      const { id } = await context.params;
      const result = await removePaymentMethod(supabase, id);
      if (!result.ok) {
        return apiNotFound(result.message);
      }
      return apiSuccess({ id });
    } catch (error) {
      logger.error('remove payment method failed', { error }, 'PaymentMethods');
      return apiInternalError('Could not remove that way to be paid.');
    }
  }
);
