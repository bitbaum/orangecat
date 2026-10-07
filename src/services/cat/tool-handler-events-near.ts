/**
 * find_events_near — "any techno parties near Zürich this weekend?"
 *
 * The Cat's way to the same nearby search /events offers: the place is
 * geocoded, the search runs as the user (events RLS decides what is public),
 * and every result carries its link so the reply can only cite real events.
 * Read-only.
 */

import { ROUTES } from '@/config/routes';
import { eventZone, formatEventShort, zoneLabel } from '@/domain/events/time';
import { normalizeGenre } from '@/config/event-crew';
import { geocodeAddress } from '@/lib/nominatim';
import {
  NEARBY_DEFAULT_RADIUS_KM,
  NEARBY_MAX_RADIUS_KM,
  searchEventsNearby,
  type NearbyEvent,
} from '@/domain/events/nearby';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { OnToolCall, RawToolCall, ToolResultMessage } from './tool-use-types';

const TOOL = 'find_events_near';
const MAX_LISTED = 10;

interface Args {
  place?: string;
  genre?: string;
  radius_km?: number;
}

function parseArgs(raw: string | undefined): Args {
  try {
    const parsed = JSON.parse(raw ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Args) : {};
  } catch {
    return {};
  }
}

/** One line per event, every fact the model may repeat and nothing it may not. */
export function formatNearbyForModel(place: string, events: NearbyEvent[]): string {
  if (events.length === 0) {
    return (
      `No upcoming public events found near ${place}. Say so plainly — never invent one — ` +
      'and offer to widen the distance or to create one (create_event).'
    );
  }
  const lines = events.slice(0, MAX_LISTED).map(e => {
    const price =
      e.is_free || !e.ticket_price ? 'free' : `${e.ticket_price} ${e.currency ?? ''}`.trim();
    const where = [e.venue_name, e.venue_city].filter(Boolean).join(', ');
    return [
      `- ${e.title} — ${formatEventShort(e.start_date, eventZone(e))} ${zoneLabel(eventZone(e))}`,
      where && `at ${where}`,
      `${e.distance_km.toFixed(1)} km away`,
      e.music_genres.length > 0 && `music: ${e.music_genres.join(', ')}`,
      e.vibe && `vibe: ${e.vibe}`,
      price,
      `link: ${ROUTES.EVENTS.VIEW(e.id)}`,
    ]
      .filter(Boolean)
      .join(' · ');
  });
  return (
    `Upcoming public events near ${place}, nearest first (times are local to each venue):\n` +
    `${lines.join('\n')}\n` +
    'Link each title you mention to its link. Mention only these events.'
  );
}

export async function handleFindEventsNear(
  supabase: AnySupabaseClient,
  toolCall: RawToolCall,
  onToolCall?: OnToolCall
): Promise<ToolResultMessage> {
  const args = parseArgs(toolCall.function.arguments);
  const place = typeof args.place === 'string' ? args.place.trim() : '';
  const genre =
    typeof args.genre === 'string' && args.genre.trim() ? normalizeGenre(args.genre) : null;
  const radius = Number(args.radius_km);
  const radiusKm =
    Number.isFinite(radius) && radius > 0
      ? Math.min(radius, NEARBY_MAX_RADIUS_KM)
      : NEARBY_DEFAULT_RADIUS_KM;
  const reply = (content: string): ToolResultMessage => ({
    role: 'tool',
    tool_call_id: toolCall.id,
    content,
  });

  onToolCall?.({ id: toolCall.id, name: TOOL, status: 'running', args: { place, genre } });

  const point = place ? await geocodeAddress(place) : null;
  if (!point) {
    onToolCall?.({ id: toolCall.id, name: TOOL, status: 'no_results' });
    return reply(
      `Could not place "${place}" on the map. Ask the user for a city or street — do not guess one.`
    );
  }

  try {
    const events = await searchEventsNearby(supabase, {
      lat: point.latitude,
      lng: point.longitude,
      radiusKm,
      genre,
    });
    if (events.length === 0) {
      onToolCall?.({ id: toolCall.id, name: TOOL, status: 'no_results' });
    } else {
      onToolCall?.({
        id: toolCall.id,
        name: TOOL,
        status: 'completed',
        resultCount: events.length,
        results: events.slice(0, MAX_LISTED).map(e => ({
          url: ROUTES.EVENTS.VIEW(e.id),
          type: 'event',
          title: e.title,
        })),
      });
    }
    const label = `${place} (within ${radiusKm} km${genre ? `, playing ${genre}` : ''})`;
    return reply(formatNearbyForModel(label, events));
  } catch (err) {
    onToolCall?.({
      id: toolCall.id,
      name: TOOL,
      status: 'failed',
      error: err instanceof Error ? err.message : 'unknown',
    });
    return reply(
      'The nearby-events search failed. Tell the user it did not work right now — never ' +
        'answer from memory — and point them to the "What\'s on near you" search on /events.'
    );
  }
}
