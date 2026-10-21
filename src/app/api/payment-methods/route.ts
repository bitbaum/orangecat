/**
 * /api/payment-methods — the ways the signed-in person accepts money that are
 * not a Bitcoin wallet (Twint, PayPal, a bank, …).
 *
 * GET  lists the caller's own rows.
 * POST adds one; the handle is normalised and validated per method.
 *
 * Ownership is RLS: the profile id always comes from the session.
 */

import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { addPaymentMethod, listOwnPaymentMethods } from '@/domain/payments/paymentMethodsService';
import {
  PAYMENT_HANDLE_MAX_LENGTH,
  PAYMENT_LABEL_MAX_LENGTH,
  PAYMENT_METHOD_IDS,
  PAYMENT_VISIBILITIES,
} from '@/config/payment-methods';
import { logger } from '@/utils/logger';

const createSchema = z.object({
  method: z.enum(PAYMENT_METHOD_IDS),
  handle: z
    .string()
    .min(1)
    .max(PAYMENT_HANDLE_MAX_LENGTH + 40),
  label: z.string().max(PAYMENT_LABEL_MAX_LENGTH).optional(),
  visibility: z.enum(PAYMENT_VISIBILITIES).optional(),
});

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;
    return apiSuccess({ methods: await listOwnPaymentMethods(supabase, user.id) });
  } catch (error) {
    logger.error('list payment methods failed', { error }, 'PaymentMethods');
    return apiInternalError('Could not load your ways to be paid.');
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many changes. Please slow down.', retryAfterSeconds(rl));
    }

    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return apiBadRequest('Invalid request', parsed.error.flatten());
    }

    const result = await addPaymentMethod(supabase, user.id, parsed.data);
    if (!result.ok) {
      return apiBadRequest(result.message, { reason: result.reason });
    }
    return apiSuccess({ method: result.row }, { status: 201 });
  } catch (error) {
    logger.error('add payment method failed', { error }, 'PaymentMethods');
    return apiInternalError('Could not save that way to be paid.');
  }
});
