/**
 * The two moments an event reaches someone outside its page: a ticket was
 * issued to you, and you were put on its crew. Fire-and-forget (the
 * dispatcher never throws); the link always goes back to the event.
 */

import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import { getAdminClient } from '@/lib/supabase/admin';
import { looseClient } from '@/lib/supabase/untyped';
import { eventZone, formatEventShort } from './time';

async function eventLine(eventId: string): Promise<{ title: string; when: string } | null> {
  const { data } = await looseClient(getAdminClient())
    .from(ENTITY_REGISTRY.event.tableName)
    .select('title, start_date, timezone')
    .eq('id', eventId)
    .maybeSingle();
  if (!data) {
    return null;
  }
  const when = data.start_date ? formatEventShort(data.start_date as string, eventZone(data)) : '';
  return { title: data.title as string, when };
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
