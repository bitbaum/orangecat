/**
 * A guest's ticket — the page IS the ticket.
 *
 * Someone without an account got a free place by giving their name; this link
 * is their key (migration 20261007160000). It shows the QR the door scans, the
 * night, and a way to give the place back. Holding the link is holding the
 * ticket, exactly as a screenshot of the QR is.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Ticket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { createServerClient } from '@/lib/supabase/server';
import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { getGuestTicket, ticketCheckInUrl } from '@/domain/events/tickets';
import { eventZone, formatEventDay, formatEventClock, zoneLabel } from '@/domain/events/time';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import TicketQr from '@/components/events/TicketQr';
import GuestTicketGiveBack from '@/components/events/GuestTicketGiveBack';

// A ticket link is a key: never indexed, never shared by a crawler.
export const metadata: Metadata = { title: 'Your ticket', robots: { index: false } };

interface PageProps {
  params: Promise<{ id: string; code: string }>;
}

export default async function GuestTicketPage({ params }: PageProps) {
  const { id, code } = await params;
  const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
  const view = await getGuestTicket(supabase, decodeURIComponent(code)).catch(() => null);

  if (!view || view.ticket.event_id !== id) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="mb-3 text-xl font-semibold text-fg-primary">No ticket at this link</h1>
        <p className="mb-6 text-fg-secondary">
          The link may be incomplete. Open it again from where you saved it.
        </p>
        <Link href={ENTITY_REGISTRY.event.publicBasePath} className="underline underline-offset-4">
          See what&apos;s on
        </Link>
      </main>
    );
  }

  const { ticket, event } = view;
  const zone = eventZone(event);
  const eventPath = ROUTES.EVENTS.VIEW(event.id);
  const place = event.venue_name || event.venue_address;
  const live = ticket.status === 'registered' || ticket.status === 'attended';

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-8">
      <div>
        <Link href={eventPath} className="text-sm text-fg-secondary underline underline-offset-4">
          {event.title}
        </Link>
        {event.start_date && (
          <p className="mt-1 text-fg-primary">
            {formatEventDay(event.start_date, zone)} · {formatEventClock(event.start_date, zone)}{' '}
            <span className="text-fg-secondary">({zoneLabel(zone)})</span>
          </p>
        )}
        {place && <p className="text-fg-secondary">{place}</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ticket className="h-5 w-5" />
            {ticket.guest_name ? `${ticket.guest_name}'s ticket` : 'Your ticket'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 text-center">
          {live ? (
            <>
              <TicketQr value={ticketCheckInUrl(event.id, ticket.ticket_code)} />
              <p className="font-mono text-sm text-fg-secondary">
                {ticket.ticket_code.slice(0, 8).toUpperCase()}
              </p>
              <p className="text-sm text-fg-secondary">
                {ticket.checked_in_at
                  ? 'Checked in — enjoy it.'
                  : 'Show this at the door. Keep this page, or take a screenshot of the code.'}
              </p>
              {!ticket.checked_in_at && (
                <GuestTicketGiveBack eventId={event.id} code={ticket.ticket_code} />
              )}
            </>
          ) : (
            <p className="text-fg-secondary">
              You gave this place back.{' '}
              <Link href={eventPath} className="underline underline-offset-4">
                Back to the event
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
