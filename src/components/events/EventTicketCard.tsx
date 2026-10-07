/**
 * The ticket box on an event page.
 *
 *   organizer → how many are coming, and the door list
 *   has one   → the ticket: a QR the door scans, the seat count, its code
 *   free      → "Get a free ticket" (seats left, when limited)
 *   paid      → where the ticket will appear once paid (the pay panel does the paying)
 *
 * Async server component: reads the viewer's own row under RLS.
 */

import Link from 'next/link';
import { DoorOpen, Ticket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { createServerClient } from '@/lib/supabase/server';
import { ROUTES } from '@/config/routes';
import {
  getMyTicket,
  getSeatsLeft,
  isLiveTicket,
  ticketCheckInUrl,
  type EventTicket,
} from '@/domain/events/tickets';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import TicketQr from './TicketQr';
import ClaimTicketButton from './ClaimTicketButton';

const OPEN_FOR_TICKETS = new Set(['published', 'open', 'full', 'ongoing']);

interface EventTicketCardProps {
  event: Record<string, unknown>;
  isOwner: boolean;
}

export default async function EventTicketCard({ event, isOwner }: EventTicketCardProps) {
  const eventId = event.id as string;
  const eventPath = ROUTES.EVENTS.VIEW(eventId);
  const isFree = Boolean(event.is_free) || !Number(event.ticket_price ?? 0);

  let ticket: EventTicket | null = null;
  let seatsLeft: number | null = null;
  let signedIn = false;
  try {
    const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = !!user;
    [ticket, seatsLeft] = await Promise.all([
      user && !isOwner ? getMyTicket(supabase, eventId, user.id) : Promise.resolve(null),
      getSeatsLeft(supabase, eventId),
    ]);
  } catch (error) {
    logger.warn('Could not load the ticket box', { eventId, error: String(error) }, 'EventTickets');
  }

  const going = Number(event.current_attendees ?? 0);
  const max = typeof event.max_attendees === 'number' ? event.max_attendees : null;

  if (isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ticket className="h-5 w-5" />
            Guests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-fg-primary">
            {going} {going === 1 ? 'ticket' : 'tickets'}
            {max ? ` of ${max}` : ''}
          </p>
          <Link
            href={`${eventPath}/door`}
            className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-default px-4 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised"
          >
            <DoorOpen className="h-4 w-4" />
            Open the door list
          </Link>
          <p className="text-sm text-fg-secondary">
            At the door, scan a guest&apos;s ticket with your phone camera — it opens the door list
            and checks them in.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLiveTicket(ticket)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ticket className="h-5 w-5" />
            Your ticket{ticket.ticket_count > 1 ? ` · ${ticket.ticket_count} people` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <TicketQr value={ticketCheckInUrl(eventId, ticket.ticket_code)} />
          <p className="font-mono text-sm text-fg-secondary">
            {ticket.ticket_code.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-sm text-fg-secondary">
            {ticket.checked_in_at
              ? 'Checked in — enjoy the night.'
              : 'Show this at the door. A screenshot works too.'}
          </p>
          {ticket.payment_status === 'free' && !ticket.checked_in_at && (
            <ClaimTicketButton eventId={eventId} mode="cancel" />
          )}
        </CardContent>
      </Card>
    );
  }

  if (!OPEN_FOR_TICKETS.has(String(event.status))) {
    return null;
  }

  const soldOut = seatsLeft === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Ticket className="h-5 w-5" />
          {isFree ? 'Free entry' : 'Tickets'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {soldOut ? (
          <p className="text-fg-primary">Sold out.</p>
        ) : (
          <>
            {seatsLeft !== null && (
              <p className="text-sm text-fg-secondary">
                {seatsLeft} {seatsLeft === 1 ? 'place' : 'places'} left
              </p>
            )}
            {isFree ? (
              signedIn ? (
                <ClaimTicketButton eventId={eventId} mode="claim" />
              ) : (
                <Link
                  href={`${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(eventPath)}`}
                  className="flex min-h-11 items-center justify-center rounded-md border border-default px-4 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised"
                >
                  Sign in to get a free ticket
                </Link>
              )
            ) : (
              <p className="text-sm text-fg-secondary">
                Pay below — your ticket, with a QR code for the door, appears here as soon as the
                payment lands.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
