import { discoverHref, parseDiscoverParams } from '@/services/discover/params';
import { DISCOVER_ORDER, DISCOVER_TYPE_SLUGS, typeFromSlug } from '@/config/discover-tabs';

describe('/discover URL', () => {
  it('reads the query, the kind and the page', () => {
    expect(parseDiscoverParams({ q: ' loki ', type: 'projects', page: '3' })).toEqual({
      q: 'loki',
      type: 'project',
      page: 3,
    });
  });

  it('keeps old links working: ?search=, ?type=profiles and ?type=people', () => {
    expect(parseDiscoverParams({ search: 'art' }).q).toBe('art');
    expect(parseDiscoverParams({ type: 'profiles' }).type).toBe('profile');
    expect(parseDiscoverParams({ type: 'people' }).type).toBe('profile');
  });

  it('treats an unknown kind as everything, and clamps the page', () => {
    expect(parseDiscoverParams({ type: 'nonsense', page: '-4' })).toEqual({
      q: '',
      type: null,
      page: 1,
    });
    expect(parseDiscoverParams({ page: '9999' }).page).toBe(20);
    expect(parseDiscoverParams({ type: 'wallets' }).type).toBeNull();
  });

  it('writes every state back as a link that parses to the same state', () => {
    for (const type of DISCOVER_ORDER) {
      const state = { q: 'zürich dj', type, page: 2 };
      const url = new URL(discoverHref(state), 'https://orangecat.ch');
      expect(parseDiscoverParams(Object.fromEntries(url.searchParams))).toEqual(state);
    }
    expect(discoverHref({})).toBe('/discover');
  });

  it('has a slug for every kind the shelf can show', () => {
    for (const type of DISCOVER_ORDER) {
      expect(typeFromSlug(DISCOVER_TYPE_SLUGS[type])).toBe(type);
    }
  });
});
