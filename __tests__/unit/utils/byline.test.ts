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
