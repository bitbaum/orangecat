import { listPlacesICanListAt, matchVenueByName, type Venue } from '@/domain/events/venue-page';

const place = (title: string): Venue => ({
  id: `a-${title}`,
  title,
  location: 'Bahnhofstrasse 5, 7302 Landquart',
  status: 'active',
});

describe('matchVenueByName — a place the user runs, never a guess', () => {
  it('matches the exact name, ignoring case', () => {
    expect(matchVenueByName([place('Espresso Bar'), place('Studio')], 'espresso bar')?.title).toBe(
      'Espresso Bar'
    );
  });

  it('accepts a close name when exactly one place fits', () => {
    expect(matchVenueByName([place('Espresso Bar Landquart')], 'Espresso Bar')?.title).toBe(
      'Espresso Bar Landquart'
    );
  });

  it('refuses when two places would fit', () => {
    expect(
      matchVenueByName(
        [place('Espresso Bar Landquart'), place('Espresso Bar Chur')],
        'Espresso Bar'
      )
    ).toBeNull();
  });

  it('refuses a fragment too short to mean much, and an empty list', () => {
    expect(matchVenueByName([place('Bar')], 'Espresso Bar')).toBeNull();
    expect(matchVenueByName([], 'Espresso Bar')).toBeNull();
  });
});

describe('listPlacesICanListAt', () => {
  it('asks the database rule the events trigger enforces', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [place('Espresso Bar')], error: null });
    expect(await listPlacesICanListAt({ rpc } as never)).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith('places_i_can_list_events_at');
  });
});
