import { venueFromText, venueQuery, withVenuePin } from '@/domain/events/venue';
import type { GeocodedVenue } from '@/lib/nominatim';

const ZURICH: GeocodedVenue = {
  latitude: 47.3779,
  longitude: 8.5265,
  venue_name: null,
  venue_address: 'Langstrasse 120',
  venue_city: 'Zürich',
  venue_postal_code: '8004',
  venue_country: 'Switzerland',
  display_name: 'Langstrasse 120, 8004 Zürich, Switzerland',
};

describe('venueQuery', () => {
  it('joins the structured address in postal order', () => {
    expect(
      venueQuery({
        venue_address: 'Langstrasse 120',
        venue_postal_code: '8004',
        venue_city: 'Zürich',
      })
    ).toBe('Langstrasse 120, 8004 Zürich');
  });

  it('uses the venue name only to narrow a city, never alone', () => {
    expect(venueQuery({ venue_name: 'Hive', venue_city: 'Zürich' })).toBe('Hive, Zürich');
    expect(venueQuery({ venue_name: 'Hive' })).toBeNull();
  });
});

describe('withVenuePin', () => {
  it('fills a missing pin and blank address parts, keeping what the person typed', async () => {
    const geocode = vi.fn().mockResolvedValue(ZURICH);
    const out = await withVenuePin(
      { venue_address: 'Langstrasse 120', venue_city: 'Zurich', latitude: null, longitude: null },
      geocode
    );
    expect(out).toMatchObject({
      latitude: 47.3779,
      longitude: 8.5265,
      venue_city: 'Zurich',
      venue_postal_code: '8004',
    });
  });

  it('does not geocode an online event or one that already has a pin', async () => {
    const geocode = vi.fn();
    await withVenuePin({ venue_city: 'Zürich', is_online: true }, geocode);
    await withVenuePin({ venue_city: 'Zürich', latitude: 1, longitude: 2 }, geocode);
    expect(geocode).not.toHaveBeenCalled();
  });

  it('leaves the event unpinned when the geocoder finds nothing', async () => {
    const out = await withVenuePin({ venue_city: 'Nowhere' }, vi.fn().mockResolvedValue(null));
    expect(out).toEqual({ venue_city: 'Nowhere' });
  });
});

describe('venueFromText', () => {
  it('splits a resolved sentence into venue fields', async () => {
    const out = await venueFromText('Langstrasse 120, Zürich', vi.fn().mockResolvedValue(ZURICH));
    expect(out).toMatchObject({
      venue_address: 'Langstrasse 120',
      venue_city: 'Zürich',
      latitude: 47.3779,
    });
  });

  it('keeps the words verbatim when they cannot be placed', async () => {
    const out = await venueFromText('the old barn', vi.fn().mockResolvedValue(null));
    expect(out).toMatchObject({ venue_address: 'the old barn', latitude: null, longitude: null });
  });
});
