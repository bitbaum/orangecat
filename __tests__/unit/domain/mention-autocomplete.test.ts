/**
 * The `@` menu: what it offers while you type, and in what order.
 *
 * Two rules are load-bearing and both are pinned here.
 *
 * The first is that the menu and the resolver agree. `activeMention` decides
 * what you are typing and `resolveMentions` decides who that is; if they read
 * text differently the menu could offer a completion the resolver would then
 * refuse to link, and the product would be lying about what it does. They share
 * one character class and one word-boundary rule, and these tests hold the
 * shared cases — an email address, a completed mention, a dotted handle.
 *
 * The second is that the Cat is first. That is the fix for a discoverability
 * bug rather than a decoration: `@cat` works everywhere and nobody guesses it.
 */

import { activeMention } from '@/domain/mentions/parse';
import { catMatchesQuery, rankMentionSuggestions } from '@/domain/mentions/rank';

describe('activeMention', () => {
  it('opens the menu on a bare @, with an empty query', () => {
    expect(activeMention('hey @')).toEqual({ start: 4, query: '' });
  });

  it('reports what has been typed so far', () => {
    expect(activeMention('hey @ali')).toEqual({ start: 4, query: 'ali' });
  });

  it('opens at the very start of an empty composer', () => {
    expect(activeMention('@c')).toEqual({ start: 0, query: 'c' });
  });

  it('closes once whitespace ends the mention', () => {
    expect(activeMention('hey @alice ')).toBeNull();
    expect(activeMention('hey @alice and')).toBeNull();
  });

  it('is not fooled by an email address', () => {
    // The `@` is preceded by a handle character, so it does not start a mention
    // — the same rule the resolver applies, which is why typing an address
    // never pops a menu offering the domain.
    expect(activeMention('mail me at bob@exam')).toBeNull();
  });

  it('handles the dotted and plus-signed handles that really exist', () => {
    // Signup derives handles from email addresses and bypasses the username
    // validator, so `m.schaupensteiner` and `butaeff+ocauth2` are real rows.
    expect(activeMention('ping @m.schaupen')).toEqual({ start: 5, query: 'm.schaupen' });
    expect(activeMention('ping @butaeff+oc')).toEqual({ start: 5, query: 'butaeff+oc' });
  });

  it('ignores text after the caret', () => {
    // Editing the middle of `@ali|ce` completes on what is typed, and must not
    // silently absorb the rest of the word.
    expect(activeMention('hey @ali')).toEqual({ start: 4, query: 'ali' });
  });

  it('gives up on a run longer than any handle can be', () => {
    expect(activeMention(`@${'a'.repeat(41)}`)).toBeNull();
  });

  it('returns nothing for text with no @ at all', () => {
    expect(activeMention('just a normal sentence')).toBeNull();
    expect(activeMention('')).toBeNull();
  });
});

describe('catMatchesQuery', () => {
  it.each(['', 'c', 'ca', 'cat', 'CAT'])('offers the Cat for %p', query => {
    expect(catMatchesQuery(query)).toBe(true);
  });

  it.each(['d', 'dan', 'catalogue'])('does not offer the Cat for %p', query => {
    // `catalogue` matters: the Cat must not hijack a longer handle that merely
    // starts with its name.
    expect(catMatchesQuery(query)).toBe(false);
  });
});

const cat = { id: 'cat-id', username: 'cat', name: 'Cat', avatar_url: null };
const people = [
  { id: 'p1', username: 'dacota-plaettli', name: 'Dacota', avatar_url: null },
  { id: 'p2', username: 'carla', name: 'Carla', avatar_url: null },
  { id: 'p3', username: 'nikolas', name: 'Cato Nikolas', avatar_url: null },
];

describe('rankMentionSuggestions', () => {
  it('puts the Cat first on a bare @, before any person', () => {
    const items = rankMentionSuggestions('', people, cat);
    expect(items[0].username).toBe('cat');
    expect(items[0].isCat).toBe(true);
  });

  it('keeps the Cat first while its handle is still being typed', () => {
    expect(rankMentionSuggestions('ca', people, cat)[0].username).toBe('cat');
  });

  it('drops the Cat once the query no longer matches it', () => {
    const items = rankMentionSuggestions('dac', people, cat);
    expect(items.some(i => i.isCat)).toBe(false);
    expect(items[0].username).toBe('dacota-plaettli');
  });

  it('prefers a handle prefix over a display-name match', () => {
    // `carla` starts with "ca"; `nikolas` only has "Cato" in its display name.
    const items = rankMentionSuggestions('ca', people, cat).filter(i => !i.isCat);
    expect(items[0].username).toBe('carla');
  });

  it('never lists the Cat twice when the people search also returned it', () => {
    const withCat = [...people, cat];
    const items = rankMentionSuggestions('ca', withCat, cat);
    expect(items.filter(i => i.isCat)).toHaveLength(1);
  });

  it('shows no Cat rather than a fake one when its profile could not be loaded', () => {
    // A synthesized row would insert a handle that may not resolve to anything.
    const items = rankMentionSuggestions('ca', people, null);
    expect(items.some(i => i.isCat)).toBe(false);
  });

  it('drops profiles with no handle — there would be nothing to insert', () => {
    const items = rankMentionSuggestions('', [{ id: 'x', username: null }], null);
    expect(items).toHaveLength(0);
  });

  it('falls back to the handle when a profile has no display name', () => {
    const items = rankMentionSuggestions('so', [{ id: 'x', username: 'solo' }], null);
    expect(items[0].name).toBe('solo');
    expect(items[0].isAnonymous).toBe(true);
  });

  // Most accounts on OrangeCat have no display name — 14 of the first 20 on
  // 2026-08-28 — because handles stopped being minted from email local parts
  // and NULL is the honest result. So this is the menu's common case, not an
  // edge one.
  describe('nameless profiles', () => {
    const nameless = [
      { id: 'a', username: 'user_d58c7dccec41' },
      { id: 'b', username: 'user_09bf1419e7e7' },
    ];

    it('offers none of them on a bare @, where they are unrecognisable hex', () => {
      expect(rankMentionSuggestions('', nameless, null)).toHaveLength(0);
    });

    it('still offers the Cat on a bare @ — it is the row worth discovering', () => {
      const items = rankMentionSuggestions('', nameless, cat);
      expect(items).toHaveLength(1);
      expect(items[0].isCat).toBe(true);
    });

    it('offers one the moment its handle is typed', () => {
      const items = rankMentionSuggestions('user_d58', nameless, null);
      expect(items[0].username).toBe('user_d58c7dccec41');
    });

    it('sinks below a named person who matches just as well', () => {
      const items = rankMentionSuggestions(
        'u',
        [{ id: 'a', username: 'user_d58c7dccec41' }, { id: 'b', username: 'ursula', name: 'Ursula' }],
        null
      );
      expect(items[0].username).toBe('ursula');
    });

    it('still wins on an exact handle match against a named person', () => {
      // Demotion must not override "this is plainly the row being asked for".
      const items = rankMentionSuggestions(
        'user_d58c7dccec41',
        [{ id: 'b', username: 'ursula', name: 'user_d58c7dccec41 fan' }, { id: 'a', username: 'user_d58c7dccec41' }],
        null
      );
      expect(items[0].username).toBe('user_d58c7dccec41');
    });
  });

  it('honours the limit', () => {
    expect(rankMentionSuggestions('', people, cat, 2)).toHaveLength(2);
  });
});
