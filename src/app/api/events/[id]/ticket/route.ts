/**
 * A ticket for one event.
 *
 * GET    — the signed-in person's ticket (or null)
 * POST   — claim a free ticket (free events only; refused when full). Signed
 *          out, the body's `name` claims a GUEST ticket: no account, and the
 *          response carries the ticket page that is the guest's key.
 * DELETE — give a free ticket back. Signed out, `?code=` names the guest
 *          ticket. Paid tickets are refunds: the organizer's call.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimitGuestTicket, rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAuthenticatedUserId } from '@/lib/api/authHelpers';
import { createServerClient } from '@/lib/supabase/server';
import {
  GUEST_NAME_MAX,
  TicketError,
  cancelFreeTicket,
  cancelGuestTicket,
  claimFreeTicket,
  claimGuestTicket,
  getMyTicket,
  guestTicketPath,
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

async function respond(run: () => Promise<Record<string, unknown>>) {
  try {
    return apiSuccess(await run());
  } catch (error) {
    if (error instanceof TicketError && error.code !== 'failed') {
      return apiError(error.message, error.code.toUpperCase(), STATUS_FOR[error.code]);
    }
    logger.error('Ticket write failed', error, 'EventTickets');
    return apiError('Could not update your ticket', 'TICKET_FAILED', 500);
  }
}

async function limited(request: NextRequest, userId: string | null) {
  const rl = userId ? await rateLimitWriteAsync(userId) : await rateLimitGuestTicket(request);
  return rl.success
    ? null
    : apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const userId = await getAuthenticatedUserId();
  const refused = await limited(request, userId);
  if (refused) {
    return refused;
  }
  if (userId) {
    return respond(async () => {
      const ticket = await claimFreeTicket(await client(), id);
      void notifyTicketIssued({ eventId: id, userId, seats: 1, paid: false });
      return { ticket };
    });
  }
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > GUEST_NAME_MAX) {
    return apiError(
      `Tell the host your name (up to ${GUEST_NAME_MAX} characters)`,
      'NAME_REQUIRED',
      400
    );
  }
  return respond(async () => {
    const ticket = await claimGuestTicket(await client(), id, name);
    return { ticket, ticketPath: guestTicketPath(id, ticket.ticket_code) };
  });
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const userId = await getAuthenticatedUserId();
  const refused = await limited(request, userId);
  if (refused) {
    return refused;
  }
  const code = request.nextUrl.searchParams.get('code');
  if (!userId && !code) {
    return apiError('Sign in, or open your ticket link', 'UNAUTHORIZED', 401);
  }
  return respond(async () => {
    if (userId) {
      await cancelFreeTicket(await client(), id);
    } else {
      await cancelGuestTicket(await client(), code as string);
    }
    return { ticket: null };
  });
}
