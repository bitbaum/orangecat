import {
  normalizeGenres,
  parseCrewRole,
  parseCrewRoles,
  MAX_MUSIC_GENRES,
  MAX_ROLE_QUANTITY,
} from '@/config/event-crew';

describe('parseCrewRole — crew lines the way people say them', () => {
  it.each([
    ['DJ', { role_title: 'DJ', quantity: 1, engagement_type: 'paid', can_check_in: false }],
    [
      '2 bartenders',
      { role_title: 'Bartender', quantity: 2, engagement_type: 'paid', can_check_in: false },
    ],
    [
      '3x security',
      { role_title: 'Security', quantity: 3, engagement_type: 'paid', can_check_in: true },
    ],
    [
      '4× helpers',
      {
        role_title: 'Setup & cleanup',
        quantity: 4,
        engagement_type: 'volunteer',
        can_check_in: false,
      },
    ],
    [
      'sound tech',
      { role_title: 'Sound technician', quantity: 1, engagement_type: 'paid', can_check_in: false },
    ],
    ['door', { role_title: 'Door', quantity: 1, engagement_type: 'paid', can_check_in: true }],
    [
      'fire dancer',
      { role_title: 'Fire dancer', quantity: 1, engagement_type: 'paid', can_check_in: false },
    ],
  ])('%s', (line, expected) => {
    expect(parseCrewRole(line)).toEqual(expected);
  });

  it('caps the head-count and ignores blanks', () => {
    expect(parseCrewRole('900 bartenders')?.quantity).toBe(MAX_ROLE_QUANTITY);
    expect(parseCrewRole('   ')).toBeNull();
  });

  it('merges repeats of the same role and drops non-strings', () => {
    expect(parseCrewRoles(['bartender', '2 bartenders', 42, 'DJ'])).toEqual([
      { role_title: 'Bartender', quantity: 3, engagement_type: 'paid', can_check_in: false },
      { role_title: 'DJ', quantity: 1, engagement_type: 'paid', can_check_in: false },
    ]);
    expect(parseCrewRoles('DJ')).toEqual([]);
  });
});

describe('normalizeGenres', () => {
  it('spells known genres the suggested way, keeps unknown ones, de-duplicates', () => {
    expect(normalizeGenres(['house', 'HOUSE', ' disco ', 'Baile funk'])).toEqual([
      'House',
      'Disco',
      'Baile funk',
    ]);
  });

  it('caps the list', () => {
    const many = Array.from({ length: 20 }, (_, i) => `genre ${i}`);
    expect(normalizeGenres(many)).toHaveLength(MAX_MUSIC_GENRES);
    expect(normalizeGenres(undefined)).toEqual([]);
  });
});
