/**
 * GET /api/bookings/[id]/receive-info
 *
 * Display-safe receiving info (method + Lightning/on-chain address, never an
 * NWC secret) for the provider of a booking, so the CUSTOMER can pay a
 * confirmed booking directly. Authorized to the booking's two parties only.
 * Resolved via the same path the rest of payments use (SSOT).
 */

import { createBookingService } from '@/services/bookings';
import { resolveSellerReceiveInfo } from '@/domain/payments';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { EntityType } from '@/config/entity-registry';
import {
  apiSuccess,
  apiNotFound,
  apiForbidden,
  apiInternalError,
} from '@/lib/api/standardResponse';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getActorIds(supabase: AnySupabaseClient, userId: string): Promise<string[]> {
  const { data: actors } = await supabase
    .from(DATABASE_TABLES.ACTORS)
    .select('id')
    .eq('user_id', userId);
  return actors?.map((a: { id: string }) => a.id) || [];
}

export const GET = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const idValidation = getValidationError(validateUUID(id, 'booking ID'));
  if (idValidation) {
    return idValidation;
  }
  try {
    const { user, supabase } = request;
    const booking = await createBookingService(supabase).getBooking(id);
    if (!booking) {
      return apiNotFound('Booking not found');
    }

    // Parties only — the address belongs to this booking's provider/customer.
    const actorIds = await getActorIds(supabase, user.id);
    const isCustomer = booking.customer_user_id === user.id;
    const isProvider = actorIds.includes(booking.provider_actor_id);
    if (!isCustomer && !isProvider) {
      return apiForbidden('Access denied');
    }

    const info = await resolveSellerReceiveInfo(
      booking.bookable_type as EntityType,
      booking.bookable_id
    );

    return apiSuccess({
      hasWallet: !!info,
      method: info?.method ?? null,
      address: info?.address ?? null,
    });
  } catch (error) {
    logger.error('Booking receive-info error', error, 'BookingsAPI');
    return apiInternalError();
  }
});
