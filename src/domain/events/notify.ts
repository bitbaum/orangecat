/**
 * The moments an event reaches someone outside its page: a ticket was issued
 * to you, someone took a ticket to your event, and you were put on its crew.
 * Fire-and-forget (the dispatcher never throws); the link always goes back
 * to the event.
 */

import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import { getAdminClient } from '@/lib/supabase/admin';
import { looseClient } from '@/lib/supabase/untyped';
import { DATABASE_TABLES } from '@/config/database-tables';
import { eventZone, formatEventShort } from './time';

async function eventLine(
  eventId: string
): Promise<{ title: string; when: string; hostId: string | null } | null> {
  const { data } = await looseClient(getAdminClient())
    .from(ENTITY_REGISTRY.event.tableName)
    .select('title, start_date, timezone, user_id')
    .eq('id', eventId)
    .maybeSingle();
  if (!data) {
    return null;
  }
  const when = data.start_date ? formatEventShort(data.start_date as string, eventZone(data)) : '';
  return {
    title: data.title as string,
    when,
    hostId: typeof data.user_id === 'string' ? data.user_id : null,
  };
}

async function displayName(userId: string): Promise<string | null> {
  const { data } = await looseClient(getAdminClient())
    .from(DATABASE_TABLES.PROFILES)
    .select('name, username')
    .eq('id', userId)
    .maybeSingle();
  const name = typeof data?.name === 'string' ? data.name.trim() : '';
  return name || (typeof data?.username === 'string' ? `@${data.username}` : null);
}

/**
 * Tell the host someone took a free ticket. A paid ticket already reaches the
 * seller as a payment; a free one reached nobody, and the host's page only
 * said "1 ticket". Guests name themselves; an account is named by its profile.
 */
export async function notifyHostTicketTaken(params: {
  eventId: string;
  /** The account that took it, when signed in. */
  userId?: string | null;
  /** The name a guest without an account gave. */
  guestName?: string | null;
}): Promise<void> {
  const event = await eventLine(params.eventId);
  if (!event?.hostId || event.hostId === params.userId) {
    return;
  }
  const who =
    params.guestName?.trim() ||
    (params.userId ? await displayName(params.userId) : null) ||
    'Someone';
  await NotificationDispatcher.dispatch({
    userId: event.hostId,
    type: 'ticket',
    title: `${who} is coming to ${event.title}`,
    message: `They took a free ticket${event.when ? ` for ${event.when}` : ''}. They are on your door list, linked from the event page.`,
    actionUrl: ROUTES.EVENTS.VIEW(params.eventId),
    sourceEntityType: 'event',
    sourceEntityId: params.eventId,
    data: { host: true, guest: Boolean(params.guestName) },
  });
}

export async function notifyTicketIssued(params: {
  eventId: string;
  userId: string;
  seats: number;
  paid: boolean;
}): Promise<void> {
  const event = await eventLine(params.eventId);
  if (!event) {
    return;
  }
  const seats = params.seats > 1 ? ` for ${params.seats} people` : '';
  await NotificationDispatcher.dispatch({
    userId: params.userId,
    type: 'ticket',
    title: `Your ticket: ${event.title}`,
    message: `You're on the list${seats}${event.when ? ` — ${event.when}` : ''}. Your QR code for the door is on the event page.`,
    actionUrl: ROUTES.EVENTS.VIEW(params.eventId),
    sourceEntityType: 'event',
    sourceEntityId: params.eventId,
    data: { paid: params.paid, seats: params.seats },
  });
}

export async function notifyCrewAssigned(params: {
  eventId: string;
  userId: string;
  roleTitle: string;
  checksIn: boolean;
}): Promise<void> {
  const event = await eventLine(params.eventId);
  if (!event) {
    return;
  }
  await NotificationDispatcher.dispatch({
    userId: params.userId,
    type: 'crew',
    title: `You're on the crew: ${params.roleTitle} at ${event.title}`,
    message: params.checksIn
      ? `${event.when ? `${event.when}. ` : ''}You can check guests in — the door list is linked from the event page.`
      : `${event.when ? `${event.when}. ` : ''}The organizer added you as ${params.roleTitle}.`,
    actionUrl: ROUTES.EVENTS.VIEW(params.eventId),
    sourceEntityType: 'event',
    sourceEntityId: params.eventId,
    data: { role: params.roleTitle },
  });
}
