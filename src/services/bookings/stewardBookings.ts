/**
 * Booking requests a steward answers on someone else's behalf.
 *
 * A place set up for a person who is not on the platform yet (ADR-0005) is
 * owned by their placeholder actor, so its bookings carry that actor as
 * provider. RLS ties provider rows to `actors.user_id = auth.uid()`, which a
 * placeholder never has — so these rows are read with the admin client, pinned
 * to exactly the placeholders this user stewards. Management only: nothing
 * here moves money.
 */
import { DATABASE_TABLES } from '@/config/database-tables';
import { getStewardedActorIds } from '@/domain/profileClaims/stewardship';
import { getAdminClient } from '@/lib/supabase/admin';
import type { BookingStatus } from './index';

export const BOOKING_WITH_CUSTOMER_SELECT = `
  *,
  customer:customer_actor_id(
    id,
    username,
    display_name,
    avatar_url
  )
`;

export async function fetchStewardedProviderBookings<Row>(
  userId: string,
  opts: { status?: BookingStatus[]; limit: number; offset: number }
): Promise<Row[]> {
  const stewarded = await getStewardedActorIds(userId);
  if (stewarded.length === 0) {
    return [];
  }
  let query = getAdminClient()
    .from(DATABASE_TABLES.BOOKINGS)
    .select(BOOKING_WITH_CUSTOMER_SELECT)
    .in('provider_actor_id', stewarded)
    .order('starts_at', { ascending: true })
    .range(opts.offset, opts.offset + opts.limit - 1);
  if (opts.status && opts.status.length > 0) {
    query = query.in('status', opts.status);
  }
  const { data } = await query;
  return (data ?? []) as Row[];
}
