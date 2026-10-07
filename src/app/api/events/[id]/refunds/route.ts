/**
 * POST /api/events/[id]/refunds { attendee_id, method: 'lightning' | 'other', note? }
 * The organizer refunds a paid ticket: the money goes back from their wallet
 * (or was given back another way), the ticket is cancelled, the seat freed.
 */
import { NextRequest } from 'next/server';
import { apiError, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAuthenticatedUserId } from '@/lib/api/authHelpers';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { EVENT_PAYOUT_METHODS, type EventPayoutMethod } from '@/config/event-payouts';
import { refundTicket } from '@/domain/events/payouts';
import { payoutResponse } from '@/lib/api/eventPayoutResponse';
import type { AnySupabaseClient } from '@/lib/supabase/types';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return apiError('Sign in to refund a ticket', 'UNAUTHORIZED', 401);
  }
  const rl = await rateLimitWriteAsync(userId);
  if (!rl.success) {
    return apiRateLimited('Too many refunds at once — wait a moment.', retryAfterSeconds(rl));
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const method = body.method as EventPayoutMethod;
  if (typeof body.attendee_id !== 'string' || !EVENT_PAYOUT_METHODS.includes(method)) {
    return apiError('Say which ticket and how it is refunded', 'VALIDATION', 400);
  }
  const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
  return payoutResponse(
    () =>
      refundTicket(
        { supabase, admin: getAdminClient() as unknown as AnySupabaseClient, organizerId: userId },
        { eventId: id, attendeeId: body.attendee_id as string, method, note: body.note }
      ),
    'refund'
  );
}
