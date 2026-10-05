import { findMyVenueByName, venueAddressLine } from '@/domain/events/venue-page';
import { pinForGroupPlace } from '@/domain/events/venue';

const group = (name: string, extra: Record<string, unknown> = {}) => ({
  id: `g-${name}`,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  avatar_url: null,
  street_address: null,
  postal_code: null,
  locality: null,
  country_code: null,
  latitude: null,
  longitude: null,
  ...extra,
});

function memberOf(...groups: ReturnType<typeof group>[]) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => Promise.resolve({ data: groups.map(g => ({ group: g })), error: null }));
  return { from: vi.fn(() => chain) } as never;
}

describe('findMyVenueByName — only a venue the user belongs to, never a guess', () => {
  it('matches the exact name, ignoring case', async () => {
    const v = await findMyVenueByName(
      memberOf(group('Espresso Bar'), group('Choir')),
      'u',
      'espresso bar'
    );
    expect(v?.name).toBe('Espresso Bar');
  });

  it('accepts a close name when exactly one organization fits', async () => {
    const v = await findMyVenueByName(
      memberOf(group('Espresso Bar Landquart')),
      'u',
      'Espresso Bar'
    );
    expect(v?.name).toBe('Espresso Bar Landquart');
  });

  it('refuses when two organizations would fit', async () => {
    const v = await findMyVenueByName(
      memberOf(group('Espresso Bar Landquart'), group('Espresso Bar Chur')),
      'u',
      'Espresso Bar'
    );
    expect(v).toBeNull();
  });

  it('refuses a fragment too short to mean much', async () => {
    expect(await findMyVenueByName(memberOf(group('Bar')), 'u', 'Espresso Bar')).toBeNull();
  });

  it('finds nothing among organizations the user is not in', async () => {
    expect(await findMyVenueByName(memberOf(), 'u', 'Espresso Bar')).toBeNull();
  });
});

describe('venue address and pin', () => {
  it('writes the door as one line', () => {
    expect(
      venueAddressLine({
        street_address: 'Bahnhofstrasse 5',
        postal_code: '7302',
        locality: 'Landquart',
      })
    ).toBe('Bahnhofstrasse 5, 7302 Landquart');
    expect(
      venueAddressLine({ street_address: null, postal_code: null, locality: null })
    ).toBeNull();
  });

  it('pins an organization only when it has a street address', async () => {
    const geocode = vi.fn().mockResolvedValue({ latitude: 46.96, longitude: 9.55 });
    expect(await pinForGroupPlace({ locality: 'Landquart' }, geocode)).toEqual({
      latitude: null,
      longitude: null,
    });
    expect(geocode).not.toHaveBeenCalled();
    expect(
      await pinForGroupPlace(
        {
          street_address: 'Bahnhofstrasse 5',
          postal_code: '7302',
          locality: 'Landquart',
          country_code: 'CH',
        },
        geocode
      )
    ).toEqual({ latitude: 46.96, longitude: 9.55 });
    expect(geocode).toHaveBeenCalledWith('Bahnhofstrasse 5, 7302 Landquart, CH');
  });
});
