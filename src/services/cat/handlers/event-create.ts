/**
 * The Cat's create_event — one sentence in, one complete event out.
 *
 * "A party at Langstrasse 120 on Saturday at 10, house and disco, I need a DJ
 * and two bartenders, 20 CHF" arrives as parameters; this puts the place on
 * the map, states the music and vibe, prices it in a real currency, and posts
 * the crew as open roles on the event. Split from entities-create.ts (500-line
 * service limit) because it is the one create that writes two tables.
 */

import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import { EVENT_TYPES } from '@/config/events';
import { MAX_VIBE_LENGTH, normalizeGenres, parseCrewRoles } from '@/config/event-crew';
import { addEventRoles, describeCrew, type EventRole } from '@/domain/events/crew';
import { venueFromText } from '@/domain/events/venue';
import { getProfileCurrency, isCurrencyCode } from '@/services/currency/profileCurrency';
import type { ActionHandler } from './types';

export const createEvent: ActionHandler = async (supabase, userId, actorId, params) => {
  // One sentence in, one complete event out: the place is put on the map,
  // the music and vibe are stated, the crew it needs is posted with it.
  const venue = await venueFromText(String(params.location ?? ''));
  const ticketPrice = Number(params.ticket_price);
  const isPaid = Number.isFinite(ticketPrice) && ticketPrice > 0;
  const currency = isCurrencyCode(params.currency)
    ? params.currency
    : await getProfileCurrency(supabase, userId);
  const eventType = EVENT_TYPES.some(t => t.value === params.event_type)
    ? (params.event_type as string)
    : undefined;
  const vibe = typeof params.vibe === 'string' ? params.vibe.trim().slice(0, MAX_VIBE_LENGTH) : '';

  const { data, error } = await supabase
    .from(ENTITY_REGISTRY.event.tableName)
    .insert({
      user_id: userId,
      actor_id: actorId,
      title: params.title,
      description: params.description || null,
      start_date: params.start_date,
      end_date: params.end_date || null,
      ...(eventType && { event_type: eventType }),
      ...venue,
      music_genres: normalizeGenres(params.music_genres),
      vibe: vibe || null,
      is_free: !isPaid,
      ticket_price: isPaid ? ticketPrice : null,
      currency,
      status: params.publish ? STATUS.EVENTS.PUBLISHED : STATUS.EVENTS.DRAFT,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  const title = params.title as string;
  const statusLabel = params.publish ? 'live' : 'draft';
  const lines = [`📅 Event "${title}" created (${statusLabel})`];
  if (venue.latitude === null) {
    lines.push(
      'Could not place the address on the map — add the city or street to make it findable nearby.'
    );
  }

  // The crew is posted after the event exists (it references it). A failure
  // here must not hide the event that was made, so it is reported, not thrown.
  const crew = parseCrewRoles(params.crew);
  let roles: EventRole[] = [];
  if (crew.length > 0) {
    try {
      roles = await addEventRoles(supabase, data.id, crew);
      lines.push(`Crew wanted: ${describeCrew(roles)}`);
    } catch (crewError) {
      lines.push(
        `The crew could not be posted (${String(crewError)}) — add it from the event page.`
      );
    }
  }

  return {
    success: true,
    data: { ...data, roles, displayMessage: lines.join('\n') },
  };
};
