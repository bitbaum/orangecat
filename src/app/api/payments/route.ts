/**
 * POST /api/payments — Initiate a payment
 *
 * Creates a payment intent, generates an invoice (NWC/LN Address/On-chain),
 * and creates an order or contribution record.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { initiatePayment } from '@/domain/payments';
import { mapKnownPaymentError } from '@/domain/payments/knownPaymentErrors';
import { paymentCreateSchema } from '@/lib/validation/finance';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { logger } from '@/utils/logger';

export const POST = withAuth(async (request: AuthenticatedRequest) => {
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
    const result = paymentCreateSchema.safeParse(body);
    if (!result.success) {
      return apiBadRequest('Invalid input', result.error.issues);
    }

    const validated = result.data;

    const paymentResult = await initiatePayment(supabase, user.id, {
      entity_type: validated.entity_type,
      entity_id: validated.entity_id,
      amount_btc: validated.amount_btc,
      message: validated.message,
      is_anonymous: validated.is_anonymous,
      shipping_address_id: validated.shipping_address_id,
      buyer_note: validated.buyer_note,
    });

    return apiSuccess(paymentResult, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment initiation failed';
    logger.error('Payment initiation failed', { error });

    // Return safe, user-friendly errors for known domain error patterns
    const safeMessage = mapKnownPaymentError(message);
    if (safeMessage) {
      return apiBadRequest(safeMessage);
    }

    return apiInternalError('Failed to initiate payment');
  }
});
