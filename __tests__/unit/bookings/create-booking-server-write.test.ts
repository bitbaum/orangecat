/**
 * A booking is written by the server.
 *
 * It used to be inserted through the customer's own session, which meant the
 * customer's role could insert bookings at all — with any price. The service
 * still reads the listing through the customer's session (that read is the
 * publication gate) but writes the row, with the provider and the price it
 * derived, through the service role (migration 20261114104100).
 */
vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/domain/profileClaims/stewardship', () => ({
  getActorStewardUserId: vi.fn().mockResolvedValue(null),
  getStewardedActorIds: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/domain/actors', () => ({
  getUserActorIds: vi.fn().mockResolvedValue(['customer-actor']),
}));
vi.mock('@/services/currency/rates.server', () => ({
  convertToBtcOrNull: vi.fn().mockResolvedValue(0.0173),
}));

import { getAdminClient } from '@/lib/supabase/admin';
import { createBookingService } from '@/services/bookings';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { createFakeSupabase } from '../../../test-utils/fakeSupabase';
import type { Mock } from 'vitest';

const input = {
  bookable_type: 'service' as const,
  bookable_id: 'svc-1',
  starts_at: '2026-12-01T10:00:00Z',
  ends_at: '2026-12-01T11:00:00Z',
};

function world(published = true) {
  const user = createFakeSupabase(
    {
      [ENTITY_REGISTRY.service.tableName]: published
        ? [{ id: 'svc-1', actor_id: 'provider-actor', fixed_price: 1000, currency: 'CHF' }]
        : [],
      [DATABASE_TABLES.ACTORS]: [],
    },
    { rpc: { check_booking_conflict: { data: false } } }
  );
  const admin = createFakeSupabase({ [DATABASE_TABLES.BOOKINGS]: [] });
  (getAdminClient as Mock).mockReturnValue(admin.client);
  return { user, admin };
}

describe('createBooking', () => {
  it('writes the row through the service role, with the price it derived', async () => {
    const { user, admin } = world();
    const result = await createBookingService(user.client).createBooking(input, 'customer-user');

    expect(result.success).toBe(true);
    // Nothing is inserted through the customer's session.
    expect(user.inserts).toEqual([]);
    expect(admin.inserts).toHaveLength(1);
    expect(admin.inserts[0]).toMatchObject({
      table: DATABASE_TABLES.BOOKINGS,
      values: {
        provider_actor_id: 'provider-actor',
        customer_actor_id: 'customer-actor',
        customer_user_id: 'customer-user',
        price_btc: 0.0173,
        status: 'pending',
      },
    });
  });

  it('still refuses a listing the customer cannot see, and writes nothing', async () => {
    const { user, admin } = world(false);
    const result = await createBookingService(user.client).createBooking(input, 'customer-user');
    expect(result.success).toBe(false);
    expect(admin.inserts).toEqual([]);
  });
});
