/**
 * Event tickets — one row per person per event (public.event_attendees),
 * carrying the code the door scans.
 *
 * Every write goes through a database function that holds the rule for it
 * (see migration 20261005100000_event_tickets.sql): a free seat is claimed
 * under a lock so the last one goes to one person, a paid ticket is issued only
 * by settlement, and only the organizer checks people in. This module is the
 * typed seam over those functions plus the two reads the pages need.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';
import { SITE_URL } from '@/config/brand';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export interface EventTicket {
  id: string;
  event_id: string;
  /** Null for a guest ticket: no account, just the name below. */
  user_id: string | null;
  guest_name: string | null;
  status: 'registered' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show';
  ticket_count: number;
  payment_status: 'pending' | 'paid' | 'refunded' | 'free';
  ticket_code: string;
  registered_at: string;
  checked_in_at: string | null;
}

export type CheckInResult =
  | {
      result: 'checked_in' | 'already';
      user_id: string | null;
      ticket_count: number;
      checked_in_at: string;
    }
  | { result: 'cancelled'; user_id: string | null }
  | { result: 'not_found' };

const SELECT =
  'id, event_id, user_id, guest_name, status, ticket_count, payment_status, ticket_code, registered_at, checked_in_at';

/** Thrown with a sentence a person can read; the code says which wall they hit. */
export class TicketError extends Error {
  constructor(
    message: string,
    readonly code: 'auth' | 'closed' | 'paid' | 'full' | 'forbidden' | 'failed'
  ) {
    super(message);
  }
}

// Postgres SQLSTATEs raised by the ticket functions → what went wrong.
const SQLSTATE: Record<string, TicketError['code']> = {
  '28000': 'auth',
  P0002: 'closed',
  '22023': 'paid',
  '23P01': 'full',
  '42501': 'forbidden',
};

function toTicketError(error: { message: string; code?: string }): TicketError {
  return new TicketError(error.message, SQLSTATE[error.code ?? ''] ?? 'failed');
}

/** A ticket is live while it can still get someone in. */
export const isLiveTicket = (t: Pick<EventTicket, 'status'> | null): t is EventTicket =>
  !!t && (t.status === 'registered' || t.status === 'attended');

/**
 * What the QR on a ticket opens: the event's door page with the code. The
 * organizer's phone camera is the scanner — the page checks the person in.
 */
export function ticketCheckInUrl(eventId: string, code: string): string {
  return `${SITE_URL}${ROUTES.EVENTS.VIEW(eventId)}/door?code=${encodeURIComponent(code)}`;
}

export async function getMyTicket(
  supabase: AnySupabaseClient,
  eventId: string,
  userId: string
): Promise<EventTicket | null> {
  const { data } = await supabase
    .from(DATABASE_TABLES.EVENT_ATTENDEES)
    .select(SELECT)
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as EventTicket | null) ?? null;
}

/** Seats left, or null when the event has no limit. */
export async function getSeatsLeft(
  supabase: AnySupabaseClient,
  eventId: string
): Promise<number | null> {
  const { data, error } = await supabase.rpc('event_seats_left', { p_event_id: eventId });
  if (error) {
    throw new Error(error.message);
  }
  return typeof data === 'number' ? data : null;
}

export async function claimFreeTicket(
  supabase: AnySupabaseClient,
  eventId: string
): Promise<EventTicket> {
  const { data, error } = await supabase.rpc('claim_free_ticket', { p_event_id: eventId });
  if (error) {
    throw toTicketError(error);
  }
  return data as EventTicket;
}

export async function cancelFreeTicket(supabase: AnySupabaseClient, eventId: string) {
  const { error } = await supabase.rpc('cancel_free_ticket', { p_event_id: eventId });
  if (error) {
    throw toTicketError(error);
  }
}

/** Settlement only — the function is granted to service_role alone. */
export async function issuePaidTicket(
  admin: AnySupabaseClient,
  eventId: string,
  userId: string,
  paymentIntentId: string
): Promise<EventTicket> {
  const { data, error } = await admin.rpc('issue_paid_ticket', {
    p_event_id: eventId,
    p_user_id: userId,
    p_payment_intent_id: paymentIntentId,
  });
  if (error) {
    throw toTicketError(error);
  }
  return data as EventTicket;
}

export async function checkInTicket(
  supabase: AnySupabaseClient,
  eventId: string,
  code: string
): Promise<CheckInResult> {
  const { data, error } = await supabase.rpc('check_in_ticket', {
    p_event_id: eventId,
    p_code: code,
  });
  if (error) {
    throw toTicketError(error);
  }
  return data as CheckInResult;
}

/** The guest list — RLS returns rows only to the event's organizer. */
export async function listTickets(
  supabase: AnySupabaseClient,
  eventId: string
): Promise<EventTicket[]> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.EVENT_ATTENDEES)
    .select(SELECT)
    .eq('event_id', eventId)
    .order('registered_at', { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as EventTicket[];
}

// ---------------------------------------------------------------- guests
// A free ticket without an account (migration 20261007160000): a name, and the
// ticket's code as the guest's key. The code is the only way back to the
// ticket, so the page it opens is the ticket.

/** The page that IS a guest's ticket: the QR for the door, and give-it-back. */
export function guestTicketPath(eventId: string, code: string): string {
  return `${ROUTES.EVENTS.VIEW(eventId)}/ticket/${encodeURIComponent(code)}`;
}

export const GUEST_NAME_MAX = 80;

export async function claimGuestTicket(
  supabase: AnySupabaseClient,
  eventId: string,
  name: string
): Promise<EventTicket> {
  const { data, error } = await supabase.rpc('claim_guest_ticket', {
    p_event_id: eventId,
    p_name: name,
  });
  if (error) {
    throw toTicketError(error);
  }
  return data as EventTicket;
}

export interface GuestTicketView {
  ticket: Pick<
    EventTicket,
    'event_id' | 'guest_name' | 'status' | 'ticket_count' | 'ticket_code' | 'checked_in_at'
  >;
  event: {
    id: string;
    title: string;
    start_date: string | null;
    timezone: string | null;
    venue_name: string | null;
    venue_address: string | null;
    status: string;
  };
}

/** A guest ticket by its code, or null. Never returns a signed-in person's ticket. */
export async function getGuestTicket(
  supabase: AnySupabaseClient,
  code: string
): Promise<GuestTicketView | null> {
  const { data, error } = await supabase.rpc('guest_ticket', { p_code: code });
  if (error) {
    throw toTicketError(error);
  }
  return (data as GuestTicketView | null) ?? null;
}

export async function cancelGuestTicket(supabase: AnySupabaseClient, code: string) {
  const { error } = await supabase.rpc('cancel_guest_ticket', { p_code: code });
  if (error) {
    throw toTicketError(error);
  }
}

/** Who a ticket is for, on the door list: the guest's own name for a guest ticket. */
export function ticketHolderName(
  ticket: Pick<EventTicket, 'user_id' | 'guest_name'>,
  nameOfUser: (userId: string) => string | undefined
): string {
  if (ticket.user_id) {
    return nameOfUser(ticket.user_id) ?? 'Guest';
  }
  return ticket.guest_name ? `${ticket.guest_name} (guest)` : 'Guest';
}
