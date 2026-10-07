/**
 * "Make a page for my bar, Espresso Bar, Bahnhofstrasse 5, Landquart" — and
 * the same for a bar whose owner is not on OrangeCat yet. Plus the
 * create_asset fix: it never set owner_id or a type, so it always failed.
 */

import { entityCreateHandlers } from '@/services/cat/handlers/entities-create';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

vi.mock('@/lib/nominatim', () => ({
  geocodeAddress: vi.fn(async () => ({
    latitude: 46.9667,
    longitude: 9.555,
    venue_name: null,
    venue_address: 'Bahnhofstrasse 5',
    venue_city: 'Landquart',
    venue_postal_code: '7302',
    venue_country: 'Switzerland',
    display_name: '…',
  })),
}));

const createProfileClaim = vi.fn();
const declineProfileClaim = vi.fn();
vi.mock('@/domain/profileClaims/service', () => ({
  createProfileClaim: (...a: unknown[]) => createProfileClaim(...a),
  declineProfileClaim: (...a: unknown[]) => declineProfileClaim(...a),
}));

function mockSupabase(error: { message: string } | null = null) {
  const inserts: Array<Record<string, unknown>> = [];
  const chain: Record<string, unknown> = {};
  chain.insert = vi.fn((row: Record<string, unknown>) => (inserts.push(row), chain));
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(() =>
    Promise.resolve(
      error ? { data: null, error } : { data: { id: 'asset-1', ...inserts.at(-1) }, error: null }
    )
  );
  return { client: { from: vi.fn(() => chain) } as never, inserts };
}

beforeEach(() => {
  createProfileClaim.mockReset();
  declineProfileClaim.mockReset();
});

describe('create_venue', () => {
  it('makes a public business page owned by the user, at the resolved address', async () => {
    const { client, inserts } = mockSupabase();
    const out = await entityCreateHandlers.create_venue(client, 'user-1', 'actor-1', {
      name: 'Espresso Bar',
      address: 'Bahnhofstrasse 5 Landquart',
    });
    expect(out.success).toBe(true);
    expect(inserts[0]).toMatchObject({
      owner_id: 'user-1',
      actor_id: 'actor-1',
      title: 'Espresso Bar',
      type: 'business',
      location: 'Bahnhofstrasse 5, 7302 Landquart',
      status: 'active',
    });
  });

  it('sets the page up for an owner who is not here, and hands back the link', async () => {
    createProfileClaim.mockResolvedValue({
      ok: true,
      data: { id: 'claim-1', token: 'tok', actorId: 'placeholder-1' },
    });
    const { client, inserts } = mockSupabase();
    const out = await entityCreateHandlers.create_venue(client, 'user-1', 'actor-1', {
      name: 'Espresso Bar',
      address: 'Bahnhofstrasse 5 Landquart',
      owner_name: 'Marco',
    });
    expect(inserts[0]).toMatchObject({ owner_id: 'user-1', actor_id: 'placeholder-1' });
    expect((out.data as { displayMessage: string }).displayMessage).toMatch(
      /set up for Marco .* send Marco the link/
    );
  });

  it('takes the placeholder down again when the page cannot be made', async () => {
    createProfileClaim.mockResolvedValue({
      ok: true,
      data: { id: 'claim-1', token: 'tok', actorId: 'placeholder-1' },
    });
    const { client } = mockSupabase({ message: 'boom' });
    const out = await entityCreateHandlers.create_venue(client, 'user-1', 'actor-1', {
      name: 'Espresso Bar',
      address: 'x',
      owner_name: 'Marco',
    });
    expect(out.success).toBe(false);
    expect(declineProfileClaim).toHaveBeenCalledWith('tok');
  });

  it('refuses without a name or an address', async () => {
    const { client } = mockSupabase();
    expect((await entityCreateHandlers.create_venue(client, 'u', 'a', { name: 'X' })).success).toBe(
      false
    );
  });
});

describe('create_asset', () => {
  it('writes the owner and a real type, which the table requires', async () => {
    const { client, inserts } = mockSupabase();
    await entityCreateHandlers.create_asset(client, 'user-1', 'actor-1', { title: 'Drill' });
    await entityCreateHandlers.create_asset(client, 'user-1', 'actor-1', {
      title: 'Van',
      asset_type: 'vehicle',
    });
    expect(inserts.map(r => [r.owner_id, r.type])).toEqual([
      ['user-1', 'other'],
      ['user-1', 'vehicle'],
    ]);
    expect(ENTITY_REGISTRY.asset.tableName).toBe('assets');
  });
});
