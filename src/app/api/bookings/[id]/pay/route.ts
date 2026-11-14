/**
 * POST /api/bookings/[id]/pay
 *
 * The customer pays a booking the provider accepted: a Bitcoin invoice on the
 * provider's own wallet for the booking's price, and the order that ties the
 * payment to the booking. Polled like any signed-in payment
 * (GET /api/payments/[id]); settlement marks the booking paid.
 */

import { BookingPaymentError, initiateBookingPayment } from '@/domain/payments/bookingPayment';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiError,
  apiInternalError,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Invoice failures a customer can act on; anything else is ours. */
const SAFE_INVOICE_ERRORS: Array<[string, string]> = [
  ['outside allowed range', 'The amount is outside what the provider’s wallet accepts.'],
  ['LNURL', 'The provider’s Lightning Address could not create an invoice. Try again later.'],
];

export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const idValidation = getValidationError(validateUUID(id, 'booking ID'));
  if (idValidation) {
    return idValidation;
  }
  const { user, supabase } = request;

  const limit = await rateLimitWriteAsync(user.id);
  if (!limit.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(limit));
  }

  try {
    const result = await initiateBookingPayment(supabase, user.id, id);
    return apiSuccess(result, { status: 201, cache: 'NONE' });
  } catch (error) {
    if (error instanceof BookingPaymentError) {
      return apiError(error.message, 'BOOKING_PAYMENT', error.status);
    }
    const message = error instanceof Error ? error.message : '';
    logger.error('Booking payment failed', { bookingId: id, error: message }, 'BookingsAPI');
    for (const [pattern, safe] of SAFE_INVOICE_ERRORS) {
      if (message.toLowerCase().includes(pattern.toLowerCase())) {
        return apiBadRequest(safe);
      }
    }
    return apiInternalError('Could not create the Bitcoin payment request.');
  }
});
