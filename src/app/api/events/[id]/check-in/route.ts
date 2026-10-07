/**
 * POST /api/events/[id]/check-in { code } — the organizer checks a ticket in
 * at the door. The database function refuses anyone else.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAuthenticatedUserId } from '@/lib/api/authHelpers';
import { createServerClient } from '@/lib/supabase/server';
import { TicketError, checkInTicket } from '@/domain/events/tickets';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return apiError('Sign in to check people in', 'UNAUTHORIZED', 401);
  }
  // 30 a minute is a guest every two seconds; camera scans go through the door
  // page, so this serves only manual check-ins.
  const rl = await rateLimitWriteAsync(userId);
  if (!rl.success) {
    return apiRateLimited('Too many check-ins at once — wait a moment.', retryAfterSeconds(rl));
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code) {
    return apiError('No ticket code', 'VALIDATION', 400);
  }
  try {
    const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
    return apiSuccess({ checkIn: await checkInTicket(supabase, id, code) });
  } catch (error) {
    if (error instanceof TicketError && error.code === 'forbidden') {
      return apiError(error.message, 'FORBIDDEN', 403);
    }
    logger.error('Check-in failed', error, 'EventTickets');
    return apiError('Could not check this ticket in', 'CHECK_IN_FAILED', 500);
  }
}
