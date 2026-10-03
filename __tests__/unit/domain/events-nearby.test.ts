import {
  parseNearbyQuery,
  NEARBY_DEFAULT_RADIUS_KM,
  NEARBY_MAX_RADIUS_KM,
} from '@/domain/events/nearby';

const q = (s: string) => parseNearbyQuery(new URLSearchParams(s));

describe('parseNearbyQuery', () => {
  it('reads a point, a radius and a genre', () => {
    expect(q('lat=47.37&lng=8.54&radius_km=5&genre=House')).toEqual({
      lat: 47.37,
      lng: 8.54,
      radiusKm: 5,
      genre: 'House',
    });
  });

  it('defaults the radius and caps it', () => {
    expect(q('lat=0&lng=0')?.radiusKm).toBe(NEARBY_DEFAULT_RADIUS_KM);
    expect(q('lat=0&lng=0&radius_km=99999')?.radiusKm).toBe(NEARBY_MAX_RADIUS_KM);
  });

  it('refuses a missing or impossible point', () => {
    expect(q('lat=47.37')).toBeNull();
    expect(q('lat=abc&lng=8')).toBeNull();
    expect(q('lat=91&lng=8')).toBeNull();
    expect(q('lat=&lng=')).toBeNull();
  });
});
