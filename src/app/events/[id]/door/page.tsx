/**
 * The door: the organizer's guest list, and what a ticket's QR opens.
 *
 * Scanning a ticket with the phone camera lands here with ?code=…; for the
 * organizer that checks the guest in and says so in one glance (green, already
 * in, or not a ticket for this event). Anyone else who opens a ticket link —
 * usually the guest themselves — is told to show it at the door.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { createServerClient } from '@/lib/supabase/server';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';
import { checkInTicket, listTickets, type CheckInResult } from '@/domain/events/tickets';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import DoorList, { type DoorGuest } from '@/components/events/DoorList';

export const metadata: Metadata = { title: 'Door', robots: { index: false } };

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ code?: string }>;
}

const VERDICT: Record<
  CheckInResult['result'],
  { icon: typeof CheckCircle2; tone: string; text: string }
> = {
  checked_in: { icon: CheckCircle2, tone: 'text-status-positive', text: 'Checked in' },
  already: { icon: AlertTriangle, tone: 'text-status-warning', text: 'Already checked in' },
  cancelled: { icon: XCircle, tone: 'text-status-negative', text: 'Ticket was cancelled' },
  not_found: { icon: XCircle, tone: 'text-status-negative', text: 'Not a ticket for this event' },
};

export default async function DoorPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { code } = await searchParams;
  const eventPath = ROUTES.EVENTS.VIEW(id);
  const supabase = (await createServerClient()) as unknown as AnySupabaseClient;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const here = `${eventPath}/door${code ? `?code=${encodeURIComponent(code)}` : ''}`;
    redirect(`${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(here)}`);
  }

  const { data: event } = await supabase
    .from(ENTITY_REGISTRY.event.tableName)
    .select('id, title, user_id, max_attendees')
    .eq('id', id)
    .maybeSingle();
  if (!event) {
    // A plain message, not a 404 call: this page streams behind events/[id]/loading.tsx, so a
    // 404 status could not be sent anyway (see scripts/audit-routes.mjs §5).
    // It is reachable only when signed in, where the words matter more.
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="mb-3 text-xl font-semibold text-fg-primary">No such event</h1>
        <Link href={ENTITY_REGISTRY.event.publicBasePath} className="underline underline-offset-4">
          See what&apos;s on
        </Link>
      </main>
    );
  }

  if (event.user_id !== user.id) {
    // Usually the guest opening their own ticket's QR.
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="mb-3 text-xl font-semibold text-fg-primary">This is a ticket</h1>
        <p className="mb-6 text-fg-secondary">
          Show it at the door of {event.title}. Only the organizer&apos;s phone checks people in.
        </p>
        <Link href={eventPath} className="underline underline-offset-4">
          Back to the event
        </Link>
      </main>
    );
  }

  const checkIn = code ? await checkInTicket(supabase, id, code) : null;
  const tickets = await listTickets(supabase, id);
  const userIds = [...new Set(tickets.map(t => t.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from(DATABASE_TABLES.PROFILES).select('id, username, name').in('id', userIds)
    : { data: [] };
  const nameOf = new Map(
    ((profiles ?? []) as Array<{ id: string; username: string; name: string | null }>).map(p => [
      p.id,
      p.name || `@${p.username}`,
    ])
  );
  const guests: DoorGuest[] = tickets
    .filter(t => t.status !== 'cancelled')
    .map(t => ({
      code: t.ticket_code,
      name: nameOf.get(t.user_id) ?? 'Guest',
      count: t.ticket_count,
      paid: t.payment_status === 'paid',
      checkedInAt: t.checked_in_at,
    }));

  const verdict = checkIn ? VERDICT[checkIn.result] : null;
  const verdictName = checkIn && 'user_id' in checkIn ? nameOf.get(checkIn.user_id) : null;
  const verdictCount = checkIn && 'ticket_count' in checkIn ? checkIn.ticket_count : 1;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <Link href={eventPath} className="text-sm text-fg-secondary underline underline-offset-4">
          {event.title}
        </Link>
        <h1 className="text-2xl font-semibold text-fg-primary">Door</h1>
      </div>

      {verdict && (
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <verdict.icon className={`h-12 w-12 shrink-0 ${verdict.tone}`} />
            <div className="min-w-0">
              <div className={`text-xl font-semibold ${verdict.tone}`}>{verdict.text}</div>
              {verdictName && (
                <div className="break-words text-fg-primary">
                  {verdictName}
                  {verdictCount > 1 ? ` · ${verdictCount} people` : ''}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <DoorList eventId={id} guests={guests} capacity={event.max_attendees ?? null} />
    </main>
  );
}
