/**
 * Booking status-change notifications.
 *
 * Guards the counterparty contract added 2026-06-13:
 *   confirm / reject / complete (provider actions) → notify the CUSTOMER
 *   cancel (customer action)                       → notify the PROVIDER
 * and: a failed status update dispatches nothing.
 */

import { createBookingService } from '@/services/bookings';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';

import type { Mock } from 'vitest';

vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));

const dispatchMock = NotificationDispatcher.dispatch as Mock;

const BOOKING = {
  id: 'booking-1',
  bookable_type: 'service',
  bookable_id: 'svc-1',
  provider_actor_id: 'provider-actor',
  customer_actor_id: 'customer-actor',
  customer_user_id: 'customer-user',
  starts_at: '2026-07-01T10:00:00Z',
  cancellation_reason: undefined as string | undefined,
};

/**
 * Chainable supabase stub. update→eq→eq→eq/in→select→single resolves the
 * booking row; the actors select→eq→single resolves the provider's user_id.
 */
function makeSupabaseStub(opts: { bookingRow: unknown; bookingError?: { message: string } }) {
  const single = vi.fn().mockResolvedValue({
    data: opts.bookingError ? null : opts.bookingRow,
    error: opts.bookingError ?? null,
  });
  const actorSingle = vi
    .fn()
    .mockResolvedValue({ data: { user_id: 'provider-user' }, error: null });

  const chain: Record<string, Mock> = {};
  for (const method of ['update', 'eq', 'in', 'select']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = single;

  const actorChain: Record<string, Mock> = {};
  for (const method of ['select', 'eq']) {
    actorChain[method] = vi.fn(() => actorChain);
  }
  actorChain.single = actorSingle;

  return {
    from: vi.fn((table: string) => (table === 'actors' ? actorChain : chain)),
  } as never;
}

afterEach(() => vi.clearAllMocks());

describe('booking status-change notifications', () => {
  it('confirmBooking notifies the customer', async () => {
    const svc = createBookingService(
      makeSupabaseStub({ bookingRow: { ...BOOKING, status: 'confirmed' } })
    );
    const result = await svc.confirmBooking('booking-1', 'provider-actor');

    expect(result.success).toBe(true);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'customer-user',
        type: 'booking_update',
        title: 'Booking confirmed',
      })
    );
  });

  it('rejectBooking notifies the customer and includes the reason', async () => {
    const svc = createBookingService(
      makeSupabaseStub({
        bookingRow: { ...BOOKING, status: 'rejected', cancellation_reason: 'double-booked' },
      })
    );
    await svc.rejectBooking('booking-1', 'provider-actor', 'double-booked');

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'customer-user',
        type: 'booking_update',
        title: 'Booking declined',
        message: expect.stringContaining('double-booked'),
      })
    );
  });

  it('completeBooking notifies the customer', async () => {
    const svc = createBookingService(
      makeSupabaseStub({ bookingRow: { ...BOOKING, status: 'completed' } })
    );
    await svc.completeBooking('booking-1', 'provider-actor');

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'customer-user',
        type: 'booking_update',
        title: 'Booking completed',
      })
    );
  });

  it('cancelBooking resolves the provider actor and notifies the provider', async () => {
    const svc = createBookingService(
      makeSupabaseStub({ bookingRow: { ...BOOKING, status: 'cancelled' } })
    );
    await svc.cancelBooking('booking-1', 'customer-user');

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'provider-user',
        type: 'booking_update',
        title: 'Booking cancelled',
      })
    );
  });

  it('dispatches nothing when the status update fails', async () => {
    const svc = createBookingService(
      makeSupabaseStub({ bookingRow: null, bookingError: { message: 'not found' } })
    );
    const result = await svc.confirmBooking('booking-1', 'provider-actor');

    expect(result.success).toBe(false);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
