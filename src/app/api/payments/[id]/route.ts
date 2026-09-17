/**
 * GET /api/payments/[id] — Check payment status
 * POST /api/payments/[id] — Perform action on payment (buyer_confirm, cancel, expire)
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiBadRequest,
  apiForbidden,
  apiNotFound,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import {
  checkPaymentStatus,
  buyerConfirmPayment,
  sellerConfirmPayment,
} from '@/domain/payments';
import { paymentActionSchema } from '@/lib/validation/finance';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { logger } from '@/utils/logger';
import { validateUUID, getValidationError } from '@/lib/api/validation';

// GET /api/payments/[id]
export const GET = withAuth(
  async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const idValidation = getValidationError(validateUUID(id, 'payment ID'));
    if (idValidation) {
      return idValidation;
    }
    try {
      const { user, supabase } = request;

      const result = await checkPaymentStatus(supabase, id, user.id);
      return apiSuccess(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Status check failed';
      logger.error('Payment status check failed', { error });

      if (message.includes('not found')) {
        return apiNotFound('Payment not found');
      }
      if (message.includes('Access denied')) {
        return apiForbidden('Access denied');
      }

      return apiInternalError('Failed to check payment status');
    }
  }
);

// POST /api/payments/[id] with body { action: 'buyer_confirm' | 'cancel' | 'expire' }
export const POST = withAuth(
  async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    const idValidation = getValidationError(validateUUID(id, 'payment ID'));
    if (idValidation) {
      return idValidation;
    }
    try {
      const { user, supabase } = request;

      // Rate limiting
      const rl = await rateLimitWriteAsync(user.id);
      if (!rl.success) {
        const retryAfter = retryAfterSeconds(rl);
        return apiRateLimited('Too many payment requests. Please slow down.', retryAfter);
      }

      const body = await request.json();

      // Zod validation
      const parsed = paymentActionSchema.safeParse(body);
      if (!parsed.success) {
        return apiBadRequest('Invalid input', parsed.error.issues);
      }

      const result =
        parsed.data.action === 'seller_confirm'
          ? await sellerConfirmPayment(supabase, id, user.id)
          : await buyerConfirmPayment(supabase, id, user.id);
      return apiSuccess(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Confirmation failed';
      logger.error('Buyer confirmation failed', { error });

      if (message.includes('not found')) {
        return apiBadRequest('Payment not found');
      }
      if (message.includes('not awaiting') || message.includes('automatically')) {
        return apiBadRequest(message);
      }

      return apiInternalError('Failed to confirm payment');
    }
  }
);
