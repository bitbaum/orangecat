/**
 * "Make a page for my bar, Espresso Bar, Bahnhofstrasse 5, Landquart" — the
 * bar becomes a company with its door on the map, and a word the model made
 * up ("bar", "venue") never becomes a kind.
 */

import { organizationHandlers } from '@/services/cat/handlers/organization';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

const geocodeAddress = vi.fn();
vi.mock('@/lib/nominatim', () => ({ geocodeAddress: (q: string) => geocodeAddress(q) }));

function mockSupabase() {
  const inserts: Array<Record<string, unknown>> = [];
  const chain: Record<string, unknown> = {};
  chain.insert = vi.fn((row: Record<string, unknown>) => (inserts.push(row), chain));
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: { id: 'g-1', ...inserts[0] }, error: null }));
  return { client: { from: vi.fn(() => chain) } as never, inserts };
}

const create = (client: never, params: Record<string, unknown>) =>
  organizationHandlers.create_organization(client, 'user-1', 'actor-1', params);

beforeEach(() => geocodeAddress.mockReset());

describe('create_organization — a venue with a door', () => {
  it('places the address: street, town, canton, country and a pin', async () => {
    geocodeAddress.mockResolvedValue({
      latitude: 46.9667,
      longitude: 9.555,
      venue_name: null,
      venue_address: 'Bahnhofstrasse 5',
      venue_city: 'Landquart',
      venue_postal_code: '7302',
      venue_country: 'Switzerland',
      country_code: 'CH',
      region: 'Graubünden',
      display_name: '…',
    });
    const { client, inserts } = mockSupabase();
    const out = await create(client, {
      name: 'Espresso Bar',
      type: 'bar',
      address: 'Bahnhofstrasse 5, Landquart',
    });
    expect(inserts[0]).toMatchObject({
      label: 'company',
      street_address: 'Bahnhofstrasse 5',
      postal_code: '7302',
      locality: 'Landquart',
      region: 'Graubünden',
      country_code: 'CH',
      latitude: 46.9667,
    });
    expect((out.data as { displayMessage: string }).displayMessage).toContain(
      'at Bahnhofstrasse 5, Landquart'
    );
  });

  it('keeps no half a place when the address cannot be resolved', async () => {
    geocodeAddress.mockResolvedValue(null);
    const { client, inserts } = mockSupabase();
    const out = await create(client, { name: 'Espresso Bar', address: 'somewhere' });
    expect(inserts[0]).not.toHaveProperty('locality');
    expect(inserts[0].label).toBe('company');
    expect((out.data as { displayMessage: string }).displayMessage).toMatch(/could not place/);
  });

  it('keeps a real kind as asked, and falls back to circle without an address', async () => {
    const { client, inserts } = mockSupabase();
    await create(client, { name: 'Builders', type: 'guild' });
    await create(client, { name: 'Friends', type: 'party crew' });
    expect(inserts.map(r => r.label)).toEqual(['guild', 'circle']);
    expect(geocodeAddress).not.toHaveBeenCalled();
    expect(ENTITY_REGISTRY.group.tableName).toBeTruthy();
  });
});
