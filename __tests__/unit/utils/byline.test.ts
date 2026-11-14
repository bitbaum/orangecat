/**
 * media#9: a minted `user_<hex>` handle was printed as an article byline, on
 * the page and in its share card. It is never a name.
 */
import { ANONYMOUS_BYLINE, bylineName, needsBylineName } from '@/utils/byline';

describe('bylineName', () => {
  it('uses the name the person set', () => {
    expect(bylineName('Mao Zhang', 'user_df091395b2ca')).toBe('Mao Zhang');
  });

  it('uses a handle the person chose when there is no name', () => {
    expect(bylineName(null, 'mao')).toBe('mao');
    expect(bylineName('  ', 'mao')).toBe('mao');
  });

  it('never prints a minted handle, even when it was copied into the name', () => {
    expect(bylineName(null, 'user_df091395b2ca')).toBe(ANONYMOUS_BYLINE);
    expect(bylineName('user_df091395b2ca', 'user_df091395b2ca')).toBe(ANONYMOUS_BYLINE);
    expect(bylineName(undefined, undefined)).toBe(ANONYMOUS_BYLINE);
  });

  it('reads as a neutral phrase', () => {
    expect(ANONYMOUS_BYLINE).toBe('An OrangeCat member');
  });
});

describe('needsBylineName', () => {
  it('asks only when the work would otherwise be signed anonymously', () => {
    expect(needsBylineName(null, 'user_e00864455095')).toBe(true);
    expect(needsBylineName('user_e00864455095', 'user_e00864455095')).toBe(true);
    expect(needsBylineName('Mao', 'user_e00864455095')).toBe(false);
    expect(needsBylineName(null, 'mao')).toBe(false);
  });
});

describe('postAuthor (every feed card)', () => {
  const { postAuthor, postAuthorSource } = jest.requireActual('@/utils/byline');

  it('signs a nameless account neutrally and prints no @line', () => {
    const author = postAuthor({
      id: 'abc',
      name: 'user_df091395b2ca',
      username: 'user_df091395b2ca',
    });
    expect(author.name).toBe(ANONYMOUS_BYLINE);
    expect(author.handle).toBeNull();
    expect(author.anonymous).toBe(true);
    // The link still reaches the real profile.
    expect(author.profileHref).toBe('/profiles/user_df091395b2ca');
  });

  it('prints a chosen name and a chosen handle', () => {
    expect(postAuthor({ name: 'Mao Zhang', username: 'mao' })).toEqual({
      name: 'Mao Zhang',
      handle: 'mao',
      profileHref: '/profiles/mao',
      anonymous: false,
    });
  });

  it('keeps a chosen name but drops a minted handle', () => {
    const author = postAuthor({ name: 'Mao Zhang', username: 'user_df091395b2ca' });
    expect(author.name).toBe('Mao Zhang');
    expect(author.handle).toBeNull();
  });

  it('falls back to the id for the link and has none for nobody', () => {
    expect(postAuthor({ id: 'abc' }).profileHref).toBe('/profiles/abc');
    expect(postAuthor(null).profileHref).toBeNull();
  });

  it('takes the original author on a repost, the poster otherwise', () => {
    const actor = { id: 'p', name: 'Poster', username: 'poster', avatar: null };
    const metadata = {
      original_actor_id: 'o',
      original_actor_name: 'user_aaaaaaaaaaaa',
      original_actor_username: 'user_aaaaaaaaaaaa',
    };
    expect(postAuthorSource(actor, metadata, false).username).toBe('poster');
    const original = postAuthorSource(actor, metadata, true);
    expect(original.id).toBe('o');
    expect(postAuthor(original).name).toBe(ANONYMOUS_BYLINE);
  });
});
