import { isPlaceholderPerson, rankPeopleForPicker } from '@/features/messaging/people-picker';

const anya = { id: '1', username: 'anya', name: 'Anya', avatar_url: 'a.png' };
const named = { id: '2', username: 'bob', name: 'Bob', avatar_url: null };
const ghost = {
  id: '3',
  username: 'user_4a12fe039064',
  name: 'user_4a12fe039064',
  avatar_url: null,
};

describe('people picker', () => {
  it('recognises unnamed placeholder accounts', () => {
    expect(isPlaceholderPerson(ghost)).toBe(true);
    expect(isPlaceholderPerson(named)).toBe(false);
    expect(isPlaceholderPerson({ ...ghost, name: 'Real Name' })).toBe(false);
  });
  it('hides placeholders without a search and ranks named-with-photo first', () => {
    expect(rankPeopleForPicker([ghost, named, anya], { searching: false }).map(p => p.id)).toEqual([
      '1',
      '2',
    ]);
  });
  it('keeps placeholders (last) when searching, and never lists yourself', () => {
    expect(
      rankPeopleForPicker([ghost, named, anya], { searching: true, selfId: '1' }).map(p => p.id)
    ).toEqual(['2', '3']);
  });
});
