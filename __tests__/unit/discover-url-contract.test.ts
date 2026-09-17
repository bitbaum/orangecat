/**
 * The /discover URL round trip.
 *
 * The page reads its filter state out of the URL in one file and writes it back
 * in another. Before `discoverUrlContract` those two halves each restated every
 * default — `'recent'`, `'all'`, the legacy `search` alias — and they agreed
 * only because someone kept them in step by hand. These tests make the
 * agreement a property: whatever the writer emits, the reader must read back
 * unchanged, for every state the UI can produce.
 *
 * A failure here is not a style problem. It means a shared link opens a
 * different list than the one the reader shared.
 */

import { describe, it, expect } from 'vitest';
import {
  readDiscoverUrl,
  writeDiscoverUrl,
  discoverUrlFor,
  DEFAULT_SORT,
  DEFAULT_TAB,
  type DiscoverUrlState,
} from '@/app/discover/discoverUrlContract';

const EMPTY: DiscoverUrlState = {
  activeTab: DEFAULT_TAB,
  searchTerm: '',
  selectedCategories: [],
  sortBy: DEFAULT_SORT,
  country: '',
  city: '',
  postal: '',
  radiusKm: 0,
};

const state = (over: Partial<DiscoverUrlState> = {}): DiscoverUrlState => ({ ...EMPTY, ...over });

/** Every state the UI can put the page in, one per param plus a full one. */
const STATES: [string, DiscoverUrlState][] = [
  ['defaults', state()],
  ['a search term', state({ searchTerm: 'bitcoin' })],
  ['one category', state({ selectedCategories: ['tech'] })],
  ['several categories', state({ selectedCategories: ['tech', 'art', 'music'] })],
  ['a non-default sort', state({ sortBy: 'relevance' })],
  ['a non-default tab', state({ activeTab: 'projects' })],
  ['a country', state({ country: 'CH' })],
  ['a city', state({ city: 'Zürich' })],
  ['a postal code', state({ postal: '8001' })],
  ['a radius', state({ radiusKm: 25 })],
  [
    'everything at once',
    state({
      activeTab: 'profiles',
      searchTerm: 'lightning node',
      selectedCategories: ['tech', 'infrastructure'],
      sortBy: 'relevance',
      country: 'CH',
      city: 'Bern',
      postal: '3000',
      radiusKm: 50,
    }),
  ],
];

describe('discover URL round trip', () => {
  it.each(STATES)('reads back what it wrote: %s', (_label, s) => {
    expect(readDiscoverUrl(writeDiscoverUrl(null, s))).toEqual(s);
  });

  it.each(STATES)('is stable on a second pass: %s', (_label, s) => {
    const once = writeDiscoverUrl(null, s);
    const twice = writeDiscoverUrl(once, readDiscoverUrl(once));
    expect(twice.toString()).toBe(once.toString());
  });
});

describe('what reaches the URL', () => {
  it('writes nothing at all for the default state', () => {
    // The bare /discover link is the one people paste. It must not grow a tail
    // of params that only restate the defaults.
    expect(writeDiscoverUrl(null, EMPTY).toString()).toBe('');
  });

  it('omits the default sort and tab but keeps the chosen ones', () => {
    expect(writeDiscoverUrl(null, state({ sortBy: DEFAULT_SORT })).has('sort')).toBe(false);
    expect(writeDiscoverUrl(null, state({ activeTab: DEFAULT_TAB })).has('type')).toBe(false);
    expect(writeDiscoverUrl(null, state({ sortBy: 'relevance' })).get('sort')).toBe('relevance');
    expect(writeDiscoverUrl(null, state({ activeTab: 'projects' })).get('type')).toBe('projects');
  });

  it('keeps params the page knows nothing about', () => {
    // A filter click must not strip a campaign tag or a referrer off the URL.
    const incoming = new URLSearchParams('utm_source=newsletter&ref=friend');
    const out = writeDiscoverUrl(incoming, state({ searchTerm: 'art' }));
    expect(out.get('utm_source')).toBe('newsletter');
    expect(out.get('ref')).toBe('friend');
    expect(out.get('q')).toBe('art');
  });

  it('clears a param the reader emptied', () => {
    const incoming = new URLSearchParams('q=old&category=tech&city=Bern&radius_km=10');
    const out = writeDiscoverUrl(incoming, EMPTY);
    expect(out.toString()).toBe('');
  });
});

describe('links that were made elsewhere', () => {
  it('still honours the legacy `search` param', () => {
    expect(readDiscoverUrl(new URLSearchParams('search=bitcoin')).searchTerm).toBe('bitcoin');
  });

  it('prefers `q` when a link carries both', () => {
    expect(readDiscoverUrl(new URLSearchParams('q=new&search=old')).searchTerm).toBe('new');
  });

  it('never writes `search` back, so a shared URL carries one spelling', () => {
    const out = writeDiscoverUrl(new URLSearchParams('search=old'), state({ searchTerm: 'new' }));
    expect(out.has('search')).toBe(false);
    expect(out.get('q')).toBe('new');
  });

  it('falls back to the defaults for values the page cannot honour', () => {
    // A stale or hand-typed link is not an error; it is a link to the default
    // list. Silently accepting `sort=cheapest` would show an order nobody asked
    // for while the control claimed otherwise.
    const parsed = readDiscoverUrl(new URLSearchParams('sort=cheapest&type=unicorns'));
    expect(parsed.sortBy).toBe(DEFAULT_SORT);
    expect(parsed.activeTab).toBe(DEFAULT_TAB);
  });

  it('treats a non-numeric radius as no radius', () => {
    // `Number('near')` is NaN, which would otherwise flow into the search
    // filters as a distance.
    expect(readDiscoverUrl(new URLSearchParams('radius_km=near')).radiusKm).toBe(0);
  });

  it('drops blank entries from a category list', () => {
    expect(readDiscoverUrl(new URLSearchParams('category=tech,,%20,art')).selectedCategories).toEqual([
      'tech',
      'art',
    ]);
  });

  it('reads an absent query string as the default state', () => {
    expect(readDiscoverUrl(null)).toEqual(EMPTY);
    expect(readDiscoverUrl(new URLSearchParams(''))).toEqual(EMPTY);
  });
});

describe('discoverUrlFor', () => {
  it('is the path the sync effect compares against', () => {
    expect(discoverUrlFor(null, EMPTY)).toBe('/discover?');
    expect(discoverUrlFor(null, state({ searchTerm: 'art' }))).toBe('/discover?q=art');
  });
});
