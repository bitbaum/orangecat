/**
 * Bookings API
 *
 * GET  /api/bookings — list bookings for the current user (as customer or
 *                     provider, filterable by status).
 * POST /api/bookings — create a pending booking for a service or asset.
 *                     Provider gets to confirm/reject via PUT /api/bookings/[id].
 *
 * Last Modified: 2026-06-05
 * Last Modified Summary: Added POST for customer-side booking creation.
 */

import { z } from 'zod';
import { createBookingService } from '@/services/bookings';
import { BookingStatus } from '@/services/bookings';
import { logger } from '@/utils/logger';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/constants/pagination';
import { apiErrorMessage } from '@/lib/api/errorMessage';

const createBookingSchema = z.object({
  bookable_type: z.enum(['service', 'asset']),
  bookable_id: z.string().guid(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  timezone: z.string().max(64).optional(),
  customer_notes: z.string().max(1000).optional(),
});

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const url = new URL(request.url);
    const role = url.searchParams.get('role') as 'customer' | 'provider' | 'both' | null;
    const statusParam = url.searchParams.get('status');
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_PAGE_SIZE)))
    );
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

    const status = statusParam ? (statusParam.split(',') as BookingStatus[]) : undefined;

    const bookingService = createBookingService(supabase);
    const bookings = await bookingService.getUserBookings(user.id, {
      role: role || 'both',
      status,
      limit,
      offset,
    });

    return apiSuccess(bookings);
  } catch (error) {
    logger.error('Fetch bookings error', error, 'BookingsAPI');
    return apiInternalError();
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const body = await request.json();
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest('Validation failed', parsed.error.flatten());
    }

    const result = await createBookingService(supabase).createBooking(parsed.data, user.id);
    if (!result.success) {
      return apiBadRequest(apiErrorMessage(result, 'Failed to create booking'));
    }
    return apiSuccess(result.booking, { status: 201 });
  } catch (error) {
    logger.error('Create booking error', error, 'BookingsAPI');
    return apiInternalError();
  }
});
