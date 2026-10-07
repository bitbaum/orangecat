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
import { formatEventShort, resolveEventTimes } from '@/domain/events/time';
import { listPlacesICanListAt, matchVenueByName } from '@/domain/events/venue-page';
import { getProfileCurrency, isCurrencyCode } from '@/services/currency/profileCurrency';
import type { ActionHandler } from './types';

export const createEvent: ActionHandler = async (supabase, userId, actorId, params) => {
  // One sentence in, one complete event out: the place is put on the map,
  // the music and vibe are stated, the crew it needs is posted with it.
  // When the user names a place they run (a bar's page), the event is listed
  // there and takes the place's address; otherwise the location they said is
  // geocoded as it stands. The place list is the database's own rule, so the
  // Cat never names a place the events trigger would then refuse.
  const venueName = typeof params.venue === 'string' ? params.venue.trim() : '';
  const place = venueName
    ? matchVenueByName(await listPlacesICanListAt(supabase).catch(() => []), venueName)
    : null;
  const where = place?.location
    ? `${place.title}, ${place.location}`
    : String(params.location ?? '');
  const venue = await venueFromText(where);
  if (place) {
    venue.venue_name = place.title;
  }
  // The model says times the way the user did — wall-clock at the venue — and
  // they become instants in the venue's zone here. Its own clock is UTC, so
  // leaving this to the model moved every non-UTC night by hours.
  const times = resolveEventTimes({
    start_date: params.start_date,
    end_date: params.end_date || null,
    timezone: venue.timezone,
  });
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
      start_date: times.start_date,
      end_date: times.end_date,
      timezone: times.timezone,
      ...(eventType && { event_type: eventType }),
      ...venue,
      asset_id: place?.id ?? null,
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
  if (place) {
    lines.push(`Listed on ${place.title}'s page.`);
  } else if (venueName) {
    lines.push(
      `${venueName} has no page you run on OrangeCat yet — say "make a page for ${venueName}, <address>" and its events will show there.`
    );
  }
  if (venue.latitude === null) {
    lines.push(
      'Could not place the address on the map — add the city or street to make it findable nearby.'
    );
  }
  if (times.timezone === 'UTC') {
    lines.push("Times are in UTC — I couldn't tell the venue's time zone. Check them on the page.");
  } else {
    lines.push(
      `Starts ${formatEventShort(times.start_date as string, times.timezone)} (${times.timezone}).`
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
