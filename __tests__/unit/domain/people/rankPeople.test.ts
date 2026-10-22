/**
 * The money screens find people by relation first: nothing typed lists the
 * circle closest first; a fragment is ranked by searchkit with the relation
 * breaking ties, and a database row the ranker cannot place stays only when
 * the fragment sits inside the name or handle.
 */

import { rankPeople, startsPerson, type FoundPerson } from '@/domain/people/rankPeople';

const person = (over: Partial<FoundPerson>): FoundPerson => ({
  id: over.username ?? 'x',
  username: 'someone',
  name: null,
  avatarUrl: null,
  relation: 'none',
  ...over,
});

describe('rankPeople', () => {
  const lena = person({ username: 'lena_m', name: 'Lena Meier', relation: 'following' });
  const leo = person({ username: 'leo', name: 'Leo Stranger' });
  const mutual = person({ username: 'ana', name: 'Ana', relation: 'mutual' });
  const asked = person({ username: 'bob', name: 'Bob', relation: 'requested' });

  it('with nothing typed lists the circle, closest relation first', () => {
    expect(rankPeople('', [leo, asked, lena, mutual]).map(p => p.username)).toEqual([
      'ana',
      'lena_m',
      'bob',
      'leo',
    ]);
  });

  it('ranks a typed fragment by the text, then the relation', () => {
    // Both names start with "le"; the one you follow comes first.
    expect(rankPeople('le', [leo, lena]).map(p => p.username)).toEqual(['lena_m', 'leo']);
    // A leading @ is how people write a handle, not part of it.
    expect(rankPeople('@leo', [lena, leo]).map(p => p.username)).toEqual(['leo']);
  });

  it('keeps a row the ranker cannot place only when the fragment is inside the name', () => {
    // "ena" is inside Lena (the database matched %ena%) but starts no word.
    expect(rankPeople('ena', [lena, leo]).map(p => p.username)).toEqual(['lena_m']);
    expect(rankPeople('zzz', [lena, leo])).toEqual([]);
  });

  it('startsPerson matches a word of the name or the handle', () => {
    expect(startsPerson(lena, 'mei')).toBe(true);
    expect(startsPerson(lena, 'LEN')).toBe(true);
    expect(startsPerson(lena, 'ena')).toBe(false);
    expect(startsPerson(lena, '')).toBe(true);
  });
});
