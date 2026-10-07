/**
 * "Any house parties near Zürich this weekend?" — the Cat answers from the
 * same nearby search as /events, and only with events that exist.
 */

import {
  handleFindEventsNear,
  formatNearbyForModel,
} from '@/services/cat/tool-handler-events-near';
import type { NearbyEvent } from '@/domain/events/nearby';

const geocodeAddress = vi.fn();
vi.mock('@/lib/nominatim', () => ({ geocodeAddress: (q: string) => geocodeAddress(q) }));

const PARTY: NearbyEvent = {
  id: 'ev-1',
  title: 'Langstrasse Rooftop',
  event_type: 'party',
  start_date: '2026-10-10T20:00:00+00:00',
  venue_name: null,
  venue_city: 'Zürich',
  music_genres: ['House', 'Disco'],
  vibe: 'Sunset into a warehouse night',
  is_free: false,
  ticket_price: 20,
  currency: 'CHF',
  thumbnail_url: null,
  distance_km: 1.15,
};

const call = (args: Record<string, unknown>) => ({
  id: 'call-1',
  type: 'function',
  function: { name: 'find_events_near', arguments: JSON.stringify(args) },
});

function supabaseReturning(rows: NearbyEvent[] | null, error: { message: string } | null = null) {
  return { rpc: vi.fn().mockResolvedValue({ data: rows, error }) };
}

beforeEach(() => {
  geocodeAddress.mockReset();
  geocodeAddress.mockResolvedValue({ latitude: 47.37, longitude: 8.54 });
});

describe('find_events_near', () => {
  it('geocodes the place and searches around it, with the genre spelled as suggested', async () => {
    const supabase = supabaseReturning([PARTY]);
    const onToolCall = vi.fn();
    const out = await handleFindEventsNear(
      supabase as never,
      call({ place: 'Zürich', genre: 'house', radius_km: 10 }) as never,
      onToolCall
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'search_events_nearby',
      expect.objectContaining({ p_lat: 47.37, p_lng: 8.54, p_radius_km: 10, p_genre: 'House' })
    );
    expect(out.content).toContain('Langstrasse Rooftop');
    expect(out.content).toContain('link: /events/ev-1');
    expect(out.content).toContain('music: House, Disco');
    expect(out.content).toContain('20 CHF');
    expect(onToolCall).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'completed', resultCount: 1 })
    );
  });

  it('asks for a place instead of guessing when it cannot be placed', async () => {
    geocodeAddress.mockResolvedValue(null);
    const supabase = supabaseReturning([]);
    const out = await handleFindEventsNear(supabase as never, call({ place: 'nowhere' }) as never);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(out.content).toMatch(/Could not place "nowhere"/);
  });

  it('says plainly when nothing is on, and when the search failed', async () => {
    const empty = await handleFindEventsNear(
      supabaseReturning([]) as never,
      call({ place: 'Zürich' }) as never
    );
    expect(empty.content).toMatch(/No upcoming public events found/);
    const failed = await handleFindEventsNear(
      supabaseReturning(null, { message: 'boom' }) as never,
      call({ place: 'Zürich' }) as never
    );
    expect(failed.content).toMatch(/search failed/);
  });

  it('caps the distance', async () => {
    const supabase = supabaseReturning([]);
    await handleFindEventsNear(
      supabase as never,
      call({ place: 'Zürich', radius_km: 9999 }) as never
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'search_events_nearby',
      expect.objectContaining({ p_radius_km: 200 })
    );
  });

  it('marks a free event as free', () => {
    expect(formatNearbyForModel('X', [{ ...PARTY, is_free: true, ticket_price: null }])).toContain(
      ' · free · '
    );
  });
});
