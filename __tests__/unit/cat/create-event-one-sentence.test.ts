/**
 * "A party at Langstrasse 120 on Saturday — house and disco, a DJ and two
 * bartenders, 20 CHF" becomes one complete event: on the map, with its sound,
 * its price and its crew.
 *
 * Until 2026-10 create_event wrote a `location` column the events table has
 * never had, and omitted currency (whose default 'SATS' the CHECK rejects), so
 * every event the Cat tried to make failed.
 */

import { entityCreateHandlers } from '@/services/cat/handlers/entities-create';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';

vi.mock('@/lib/nominatim', () => ({
  geocodeAddress: vi.fn(async (q: string) =>
    q.includes('Landquart')
      ? {
          latitude: 46.9667,
          longitude: 9.555,
          venue_name: null,
          venue_address: 'Bahnhofstrasse 5',
          venue_city: 'Landquart',
          venue_postal_code: '7302',
          venue_country: 'Switzerland',
          country_code: 'CH',
          display_name: 'Bahnhofstrasse 5, 7302 Landquart, Switzerland',
        }
      : q.includes('Langstrasse')
        ? {
            latitude: 47.3779,
            longitude: 8.5265,
            venue_name: null,
            venue_address: 'Langstrasse 120',
            venue_city: 'Zürich',
            venue_postal_code: '8004',
            venue_country: 'Switzerland',
            country_code: 'CH',
            display_name: 'Langstrasse 120, 8004 Zürich, Switzerland',
          }
        : null
  ),
}));

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

let myVenues: Array<Record<string, unknown>> = [];
beforeEach(() => {
  myVenues = [];
});

function mockSupabase(profileCurrency: string | null = 'EUR') {
  const inserts: Record<string, unknown[]> = {};
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    chain.insert = vi.fn((payload: unknown) => {
      (inserts[table] ??= []).push(payload);
      return chain;
    });
    chain.select = vi.fn(() => {
      if (table === DATABASE_TABLES.EVENT_ROLES) {
        const rows = (inserts[table]?.[0] as Record<string, unknown>[]).map((r, i) => ({
          id: `role-${i}`,
          status: 'open',
          ...r,
        }));
        return Promise.resolve({ data: rows, error: null });
      }
      return chain;
    });
    chain.eq = vi.fn(() => chain);
    chain.single = vi.fn().mockResolvedValue({ data: { id: 'event-1' }, error: null });
    chain.maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { currency: profileCurrency }, error: null });
    return chain;
  });
  const rpc = vi.fn((fn: string) =>
    Promise.resolve(
      fn === 'places_i_can_list_events_at'
        ? { data: myVenues, error: null }
        : { data: null, error: { message: `unexpected rpc ${fn}` } }
    )
  );
  return { client: { from, rpc } as never, inserts };
}

const run = (supabase: never, params: Record<string, unknown>) =>
  entityCreateHandlers.create_event(supabase, 'user-1', 'actor-1', params);

describe('Cat create_event — one sentence, one complete event', () => {
  it('writes only real columns: venue fields + pin, sound, price, currency', async () => {
    const { client, inserts } = mockSupabase();
    const result = await run(client, {
      title: 'Langstrasse Rooftop',
      start_date: '2026-10-10T22:00:00+02:00',
      location: 'Langstrasse 120, Zürich',
      event_type: 'party',
      music_genres: ['house', 'Disco'],
      vibe: 'Sunset into a warehouse night',
      ticket_price: 20,
      currency: 'CHF',
      publish: true,
    });
    expect(result.success).toBe(true);

    const row = inserts[ENTITY_REGISTRY.event.tableName][0] as Record<string, unknown>;
    expect(row).not.toHaveProperty('location');
    expect(row).toMatchObject({
      actor_id: 'actor-1',
      user_id: 'user-1',
      event_type: 'party',
      venue_address: 'Langstrasse 120',
      venue_city: 'Zürich',
      latitude: 47.3779,
      longitude: 8.5265,
      music_genres: ['House', 'Disco'],
      vibe: 'Sunset into a warehouse night',
      is_free: false,
      ticket_price: 20,
      currency: 'CHF',
      status: 'published',
    });
  });

  it('posts the crew as open roles on the new event', async () => {
    const { client, inserts } = mockSupabase();
    const result = await run(client, {
      title: 'Party',
      start_date: '2026-10-10T22:00:00+02:00',
      location: 'Langstrasse 120, Zürich',
      crew: ['1 DJ', '2 bartenders'],
    });
    expect(inserts[DATABASE_TABLES.EVENT_ROLES][0]).toEqual([
      expect.objectContaining({ event_id: 'event-1', role_title: 'DJ', quantity: 1 }),
      expect.objectContaining({ event_id: 'event-1', role_title: 'Bartender', quantity: 2 }),
    ]);
    expect((result.data as { displayMessage: string }).displayMessage).toContain(
      'Crew wanted: DJ, 2× Bartender'
    );
  });

  it('is free and priced in the person’s own currency when nothing is said', async () => {
    const { client, inserts } = mockSupabase('EUR');
    await run(client, {
      title: 'Meetup',
      start_date: '2026-10-10T19:00:00Z',
      location: 'the old barn',
    });
    const row = inserts[ENTITY_REGISTRY.event.tableName][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      is_free: true,
      ticket_price: null,
      currency: 'EUR',
      venue_address: 'the old barn',
      latitude: null,
      status: 'draft',
      event_type: 'meetup',
    });
    expect(inserts[DATABASE_TABLES.EVENT_ROLES]).toBeUndefined();
  });

  it('lists the event at the bar\u2019s page and takes its address', async () => {
    myVenues = [
      {
        id: 'bar-1',
        title: 'Espresso Bar',
        location: 'Bahnhofstrasse 5, 7302 Landquart',
        status: 'active',
      },
    ];
    const { client, inserts } = mockSupabase();
    const result = await run(client, {
      title: 'Electronic Night',
      start_date: '2026-10-09T21:00:00+02:00',
      location: 'Espresso Bar, Landquart',
      venue: 'Espresso Bar',
      music_genres: ['electronic'],
    });
    const row = inserts[ENTITY_REGISTRY.event.tableName][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      asset_id: 'bar-1',
      venue_name: 'Espresso Bar',
      venue_address: 'Bahnhofstrasse 5',
      venue_city: 'Landquart',
      latitude: 46.9667,
      music_genres: ['Electronic'],
    });
    expect(row).not.toHaveProperty('venue_group_id');
    expect((result.data as { displayMessage: string }).displayMessage).toContain(
      "Listed on Espresso Bar's page."
    );
  });

  it('reads the words for when, in the venue\u2019s zone, when the model passes them through', async () => {
    // 2026-10-07: "a concert today at 7pm at Rote Fabrik, 1 franc". A weak model
    // sends "today at 7pm" where ISO was asked; it must become 19:00 in Zürich
    // (17:00Z in October), never text in a timestamp column.
    vi.useFakeTimers({ now: new Date('2026-10-07T11:10:00Z'), toFake: ['Date'] });
    try {
      const { client, inserts } = mockSupabase('CHF');
      const result = await run(client, {
        title: 'Concert at Rote Fabrik',
        start_date: 'today at 7pm',
        location: 'Langstrasse 120, Zürich',
        ticket_price: 1,
      });
      expect(result.success).toBe(true);
      const row = inserts[ENTITY_REGISTRY.event.tableName][0] as Record<string, unknown>;
      expect(row).toMatchObject({
        start_date: '2026-10-07T17:00:00.000Z',
        timezone: 'Europe/Zurich',
        ticket_price: 1,
        is_free: false,
        currency: 'CHF',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('asks for a time instead of guessing one', async () => {
    const { client, inserts } = mockSupabase();
    const result = await run(client, { title: 'Concert', start_date: 'today', location: 'Zürich' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/today/);
    expect(inserts[ENTITY_REGISTRY.event.tableName]).toBeUndefined();
  });

  it('says how to give a venue a page when the user has none by that name', async () => {
    const { client, inserts } = mockSupabase();
    const result = await run(client, {
      title: 'Electronic Night',
      start_date: '2026-10-09T21:00:00+02:00',
      location: 'Langstrasse 120, Zürich',
      venue: 'Espresso Bar',
    });
    const row = inserts[ENTITY_REGISTRY.event.tableName][0] as Record<string, unknown>;
    expect(row.asset_id).toBeNull();
    expect(row.venue_address).toBe('Langstrasse 120');
    expect((result.data as { displayMessage: string }).displayMessage).toMatch(
      /Espresso Bar has no page you run/
    );
  });

  it('reads "Friday 22:00" as 22:00 at the venue, not 22:00 UTC', async () => {
    const { client, inserts } = mockSupabase();
    const result = await run(client, {
      title: 'Electronic Night',
      start_date: '2026-10-09T22:00',
      end_date: '2026-10-10T03:00',
      location: 'Bahnhofstrasse 5, Landquart',
    });
    const row = inserts[ENTITY_REGISTRY.event.tableName][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      timezone: 'Europe/Zurich',
      start_date: '2026-10-09T20:00:00.000Z',
      end_date: '2026-10-10T01:00:00.000Z',
    });
    expect((result.data as { displayMessage: string }).displayMessage).toContain(
      'Starts Fri, Oct 9, 10:00 PM (Europe/Zurich)'
    );
  });
});
