/**
 * POST /api/event-roles/[id]/pay { user_id, method: 'lightning' | 'other', note? }
 * The organizer pays one crew member their role's fee — sent from their own
 * wallet, or recorded as paid another way. See domain/events/payouts.
 */
import { NextRequest } from 'next/server';
import { apiError, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAuthenticatedUserId } from '@/lib/api/authHelpers';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { EVENT_PAYOUT_METHODS, type EventPayoutMethod } from '@/config/event-payouts';
import { payCrewMember } from '@/domain/events/payouts';
import { payoutResponse } from '@/lib/api/eventPayoutResponse';
import type { AnySupabaseClient } from '@/lib/supabase/types';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return apiError('Sign in to pay your crew', 'UNAUTHORIZED', 401);
  }
  const rl = await rateLimitWriteAsync(userId);
  if (!rl.success) {
    return apiRateLimited('Too many payments at once — wait a moment.', retryAfterSeconds(rl));
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const method = body.method as EventPayoutMethod;
  if (typeof body.user_id !== 'string' || !EVENT_PAYOUT_METHODS.includes(method)) {
    return apiError('Say who to pay and how', 'VALIDATION', 400);
  }
  const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
  return payoutResponse(
    () =>
      payCrewMember(
        { supabase, admin: getAdminClient() as unknown as AnySupabaseClient, organizerId: userId },
        { roleId: id, recipientUserId: body.user_id as string, method, note: body.note }
      ),
    'payment'
  );
}
