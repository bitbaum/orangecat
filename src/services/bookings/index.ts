/**
 * Booking Service
 *
 * Handles booking operations for services and asset rentals.
 * Provides availability checking, booking creation, and status management.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';

import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { logger } from '@/utils/logger';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import { convertToBtcOrNull } from '@/services/currency/rates.server';
import type { CurrencyCode } from '@/config/currencies';
import { APP_LOCALE } from '@/utils/locale';

// Types
type BookableType = 'service' | 'asset';

export type BookingStatus =
  'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rejected' | 'no_show';

export interface Booking {
  id: string;
  bookable_type: BookableType;
  bookable_id: string;
  provider_actor_id: string;
  customer_actor_id: string;
  customer_user_id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  duration_minutes?: number;
  price_btc: number;
  currency: string;
  deposit_btc: number;
  deposit_paid: boolean;
  total_paid_btc: number;
  status: BookingStatus;
  customer_notes?: string;
  provider_notes?: string;
  cancellation_reason?: string;
  metadata?: Record<string, unknown>;
  confirmed_at?: string;
  cancelled_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

interface BookingResult {
  success: boolean;
  booking?: Booking;
  error?: string;
}

export interface CreateBookingInput {
  bookable_type: BookableType;
  bookable_id: string;
  starts_at: string;
  ends_at: string;
  timezone?: string;
  customer_notes?: string;
}

function formatBookingStart(startsAt: string): string {
  return new Date(startsAt).toLocaleString(APP_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Booking Service Class
 */
class BookingService {
  constructor(private supabase: AnySupabaseClient) {}

  private async updateBookingStatus(opts: {
    bookingId: string;
    updateData: Record<string, unknown>;
    actorField: string;
    actorId: string;
    allowedStatuses: string[];
    errorMessage: string;
  }): Promise<BookingResult> {
    let q = this.supabase
      .from(DATABASE_TABLES.BOOKINGS)
      .update(opts.updateData)
      .eq('id', opts.bookingId)
      .eq(opts.actorField, opts.actorId);
    q =
      opts.allowedStatuses.length === 1
        ? q.eq('status', opts.allowedStatuses[0])
        : q.in('status', opts.allowedStatuses);
    const { data: booking, error } = await q.select().single();
    if (error || !booking) {
      return { success: false, error: opts.errorMessage };
    }
    // Fire-and-forget, like notifyProviderOfBooking: a notification failure
    // must never roll back or block the status change itself.
    void this.notifyCounterpartyOfStatusChange(booking as Booking);
    return { success: true, booking };
  }

  /**
   * Create a pending booking. Looks up the bookable to derive provider +
   * price, resolves the customer's actor (first one for the user), checks
   * for a scheduling conflict via check_booking_conflict(), then inserts
   * with status='pending' for the provider to confirm or reject.
   */
  async createBooking(input: CreateBookingInput, customerUserId: string): Promise<BookingResult> {
    if (new Date(input.ends_at) <= new Date(input.starts_at)) {
      return { success: false, error: 'ends_at must be after starts_at' };
    }

    // Resolve provider + price from the bookable. Select '*' and treat
    // the row as a generic record — the dynamic-column select string
    // confuses Supabase's typed query builder.
    const tableName = ENTITY_REGISTRY[input.bookable_type].tableName;
    const { data: bookable, error: bookableErr } = await this.supabase
      .from(tableName)
      .select('*')
      .eq('id', input.bookable_id)
      .single();
    if (bookableErr || !bookable) {
      return { success: false, error: `${input.bookable_type} not found` };
    }
    const row = bookable as unknown as Record<string, unknown>;
    const providerActorId = typeof row.actor_id === 'string' ? row.actor_id : '';
    if (!providerActorId) {
      return { success: false, error: `${input.bookable_type} has no actor_id` };
    }
    // Asset rental_price_btc is genuinely BTC; service fixed_price is in the listing's
    // OWN currency (e.g. CHF) and MUST be converted — otherwise a 50 CHF service was
    // recorded as 50 BTC (currency:'BTC' hardcoded below). Mirror resolveAmount() in
    // paymentFlowService so the booking record stores real BTC.
    const priceCol = input.bookable_type === 'service' ? 'fixed_price' : 'rental_price_btc';
    const rawPrice = Number(row[priceCol] ?? 0);
    let priceBtc = rawPrice;
    if (input.bookable_type === 'service' && rawPrice > 0) {
      // A booking records what the customer owes. Without a real rate we cannot
      // say what a fiat price is in Bitcoin, and writing a guess (or a zero)
      // into the record is worse than making them try again in a moment.
      const converted = await convertToBtcOrNull(
        rawPrice,
        String(row.currency || 'BTC').toUpperCase() as CurrencyCode
      );
      if (converted === null || !(converted > 0)) {
        throw new Error('Bitcoin exchange rate unavailable; could not price this booking');
      }
      priceBtc = converted;
    }
    const durationMinutes =
      input.bookable_type === 'service' ? ((row.duration_minutes as number | null) ?? null) : null;

    // Resolve customer actor (first one — most users have exactly one)
    const { data: actors } = await this.supabase
      .from(DATABASE_TABLES.ACTORS)
      .select('id')
      .eq('user_id', customerUserId)
      .limit(1);
    const customerActorId = actors?.[0]?.id;
    if (!customerActorId) {
      return { success: false, error: 'No actor found for customer' };
    }
    if (customerActorId === providerActorId) {
      return { success: false, error: 'Cannot book your own listing' };
    }

    // Conflict check (rejects overlap with other confirmed/in_progress bookings)
    const { data: conflict } = await this.supabase.rpc('check_booking_conflict', {
      p_bookable_type: input.bookable_type,
      p_bookable_id: input.bookable_id,
      p_starts_at: input.starts_at,
      p_ends_at: input.ends_at,
    });
    if (conflict === true) {
      return { success: false, error: 'Time slot is already booked' };
    }

    const { data: booking, error: insertErr } = await this.supabase
      .from(DATABASE_TABLES.BOOKINGS)
      .insert({
        bookable_type: input.bookable_type,
        bookable_id: input.bookable_id,
        provider_actor_id: providerActorId,
        customer_actor_id: customerActorId,
        customer_user_id: customerUserId,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        timezone: input.timezone ?? 'UTC',
        duration_minutes: durationMinutes,
        price_btc: priceBtc,
        currency: 'BTC',
        status: STATUS.BOOKINGS.PENDING,
        customer_notes: input.customer_notes,
      })
      .select()
      .single();

    if (insertErr || !booking) {
      logger.error('Insert booking failed', { error: insertErr }, 'BookingService');
      return { success: false, error: insertErr?.message ?? 'Failed to create booking' };
    }

    // Notify the provider that a new booking is awaiting their decision.
    // Fire-and-forget: dispatcher swallows its own errors so booking creation
    // is never blocked by a notification failure.
    void this.notifyProviderOfBooking(providerActorId, booking, input.bookable_type);

    return { success: true, booking };
  }

  private async resolveActorUserId(actorId: string): Promise<string | null> {
    const { data: actor } = await this.supabase
      .from(DATABASE_TABLES.ACTORS)
      .select('user_id')
      .eq('id', actorId)
      .single<{ user_id: string | null }>();
    return actor?.user_id ?? null;
  }

  private async notifyProviderOfBooking(
    providerActorId: string,
    booking: Booking,
    bookableType: BookableType
  ): Promise<void> {
    const providerUserId = await this.resolveActorUserId(providerActorId);
    if (!providerUserId) {
      return;
    }

    void NotificationDispatcher.dispatch({
      userId: providerUserId,
      type: 'booking_request',
      title: 'New booking request',
      message: `A customer requested to book your ${bookableType} starting ${formatBookingStart(booking.starts_at)}.`,
      data: { bookingId: booking.id, bookableType, startsAt: booking.starts_at },
      sourceEntityType: bookableType,
      sourceEntityId: booking.bookable_id,
      actionUrl: ROUTES.DASHBOARD.BOOKINGS,
    });
  }

  /**
   * Notify the counterparty when a booking changes status. The new status
   * implies both the event and the recipient: confirmed/rejected/completed
   * are provider actions (notify the customer), cancelled is a customer
   * action (notify the provider).
   */
  private async notifyCounterpartyOfStatusChange(booking: Booking): Promise<void> {
    const startLocal = formatBookingStart(booking.starts_at);
    const reasonSuffix = booking.cancellation_reason
      ? ` Reason: ${booking.cancellation_reason}`
      : '';

    let userId: string | null;
    let title: string;
    let message: string;

    switch (booking.status) {
      case STATUS.BOOKINGS.CONFIRMED:
        userId = booking.customer_user_id;
        title = 'Booking confirmed';
        message = `Your ${booking.bookable_type} booking starting ${startLocal} was confirmed.`;
        break;
      case STATUS.BOOKINGS.REJECTED:
        userId = booking.customer_user_id;
        title = 'Booking declined';
        message = `Your ${booking.bookable_type} booking starting ${startLocal} was declined.${reasonSuffix}`;
        break;
      case STATUS.BOOKINGS.COMPLETED:
        userId = booking.customer_user_id;
        title = 'Booking completed';
        message = `Your ${booking.bookable_type} booking starting ${startLocal} was marked as completed.`;
        break;
      case STATUS.BOOKINGS.CANCELLED:
        userId = await this.resolveActorUserId(booking.provider_actor_id);
        title = 'Booking cancelled';
        message = `The customer cancelled the ${booking.bookable_type} booking starting ${startLocal}.${reasonSuffix}`;
        break;
      default:
        return;
    }
    if (!userId) {
      return;
    }

    void NotificationDispatcher.dispatch({
      userId,
      type: 'booking_update',
      title,
      message,
      data: {
        bookingId: booking.id,
        bookableType: booking.bookable_type,
        status: booking.status,
        startsAt: booking.starts_at,
      },
      sourceEntityType: booking.bookable_type,
      sourceEntityId: booking.bookable_id,
      actionUrl: ROUTES.DASHBOARD.BOOKINGS,
    });
  }

  async confirmBooking(bookingId: string, providerActorId: string): Promise<BookingResult> {
    return this.updateBookingStatus({
      bookingId,
      updateData: { status: STATUS.BOOKINGS.CONFIRMED, confirmed_at: new Date().toISOString() },
      actorField: 'provider_actor_id',
      actorId: providerActorId,
      allowedStatuses: [STATUS.BOOKINGS.PENDING],
      errorMessage: 'Failed to confirm booking',
    });
  }

  async rejectBooking(
    bookingId: string,
    providerActorId: string,
    reason?: string
  ): Promise<BookingResult> {
    return this.updateBookingStatus({
      bookingId,
      updateData: {
        status: STATUS.BOOKINGS.REJECTED,
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
      },
      actorField: 'provider_actor_id',
      actorId: providerActorId,
      allowedStatuses: [STATUS.BOOKINGS.PENDING],
      errorMessage: 'Failed to reject booking',
    });
  }

  async cancelBooking(
    bookingId: string,
    customerUserId: string,
    reason?: string
  ): Promise<BookingResult> {
    return this.updateBookingStatus({
      bookingId,
      updateData: {
        status: STATUS.BOOKINGS.CANCELLED,
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
      },
      actorField: 'customer_user_id',
      actorId: customerUserId,
      allowedStatuses: [STATUS.BOOKINGS.PENDING, STATUS.BOOKINGS.CONFIRMED],
      errorMessage: 'Failed to cancel booking',
    });
  }

  async completeBooking(bookingId: string, providerActorId: string): Promise<BookingResult> {
    return this.updateBookingStatus({
      bookingId,
      updateData: { status: STATUS.BOOKINGS.COMPLETED, completed_at: new Date().toISOString() },
      actorField: 'provider_actor_id',
      actorId: providerActorId,
      allowedStatuses: [STATUS.BOOKINGS.CONFIRMED, STATUS.BOOKINGS.IN_PROGRESS],
      errorMessage: 'Failed to complete booking',
    });
  }

  /**
   * Get bookings for a user (as customer or provider)
   */
  async getUserBookings(
    userId: string,
    options: {
      role?: 'customer' | 'provider' | 'both';
      status?: BookingStatus[];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<
    (Booking & {
      customer?: { id: string; username: string; display_name?: string; avatar_url?: string };
    })[]
  > {
    const { role = 'both', status, limit = 20, offset = 0 } = options;

    // Get user's actor IDs
    const { data: actors } = await this.supabase
      .from(DATABASE_TABLES.ACTORS)
      .select('id')
      .eq('user_id', userId);

    const actorIds = actors?.map(a => a.id) || [];

    let query = this.supabase
      .from(DATABASE_TABLES.BOOKINGS)
      .select(
        `
        *,
        customer:customer_actor_id(
          id,
          username,
          display_name,
          avatar_url
        )
      `
      )
      .order('starts_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (role === 'customer') {
      query = query.eq('customer_user_id', userId);
    } else if (role === 'provider') {
      query = query.in('provider_actor_id', actorIds);
    } else {
      query = query.or(
        `customer_user_id.eq.${userId},provider_actor_id.in.(${actorIds.join(',')})`
      );
    }

    if (status && status.length > 0) {
      query = query.in('status', status);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching bookings', { error }, 'BookingService');
      return [];
    }

    return data || [];
  }

  /**
   * Get booking by ID
   */
  async getBooking(bookingId: string): Promise<Booking | null> {
    const { data, error } = await this.supabase
      .from(DATABASE_TABLES.BOOKINGS)
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }
}

/**
 * Create booking service instance
 */
export function createBookingService(supabase: AnySupabaseClient): BookingService {
  return new BookingService(supabase);
}
