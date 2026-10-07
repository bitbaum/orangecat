/**
 * The signed-in person's ticket for one event.
 *
 * GET    — their ticket (or null)
 * POST   — claim a free ticket (free events only; refused when full)
 * DELETE — give a free ticket back. Paid tickets are refunds: the organizer's call.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAuthenticatedUserId } from '@/lib/api/authHelpers';
import { createServerClient } from '@/lib/supabase/server';
import {
  TicketError,
  cancelFreeTicket,
  claimFreeTicket,
  getMyTicket,
} from '@/domain/events/tickets';
import { notifyTicketIssued } from '@/domain/events/notify';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';

type Ctx = { params: Promise<{ id: string }> };

const STATUS_FOR: Record<TicketError['code'], number> = {
  auth: 401,
  closed: 404,
  paid: 409,
  full: 409,
  forbidden: 403,
  failed: 500,
};

const client = async () => (await createServerClient()) as unknown as AnySupabaseClient;

export async function GET(_request: NextRequest, { params }: Ctx) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return apiSuccess({ ticket: null });
  }
  const { id } = await params;
  return apiSuccess({ ticket: await getMyTicket(await client(), id, userId) });
}

async function write(run: (supabase: AnySupabaseClient) => Promise<unknown>) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return apiError('Sign in to get a ticket', 'UNAUTHORIZED', 401);
  }
  const rl = await rateLimitWriteAsync(userId);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }
  try {
    return apiSuccess({ ticket: (await run(await client())) ?? null });
  } catch (error) {
    if (error instanceof TicketError && error.code !== 'failed') {
      return apiError(error.message, error.code.toUpperCase(), STATUS_FOR[error.code]);
    }
    logger.error('Ticket write failed', error, 'EventTickets');
    return apiError('Could not update your ticket', 'TICKET_FAILED', 500);
  }
}

export async function POST(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return write(async supabase => {
    const ticket = await claimFreeTicket(supabase, id);
    void notifyTicketIssued({ eventId: id, userId: ticket.user_id, seats: 1, paid: false });
    return ticket;
  });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return write(async supabase => {
    await cancelFreeTicket(supabase, id);
    return null;
  });
}
