import { describe, it, expect } from 'vitest';
import { foldName, handleOf, parseMentions } from '@/services/companions/rooms/mentions';
import type { RoomMember } from '@/services/companions/rooms/types';

const member = (id: string, name: string): RoomMember => ({
  id,
  kind: 'companion',
  assistantId: id,
  fleetSlug: null,
  name,
  job: null,
  avatarUrl: null,
  position: 0,
});

const ada = member('a', 'Ada');
const eagle = member('e', 'Legal eagle');
const max = member('m', 'Max');
const planck = member('p', 'Max Planck');
const diplo = member('d', 'Diplodoctor');
const members = [ada, eagle, max, planck, diplo];

describe('parseMentions', () => {
  it('finds a member by its handle, whatever the case', () => {
    expect(parseMentions('@ada what do you think?', members).members).toEqual([ada]);
    expect(parseMentions('Ask @DIPLODOCTOR.', members).members).toEqual([diplo]);
  });

  it('reads a two-word name with or without the space', () => {
    expect(parseMentions('@LegalEagle is that a deadline?', members).members).toEqual([eagle]);
    expect(parseMentions('@Legal eagle is that a deadline?', members).members).toEqual([eagle]);
  });

  it('prefers the longest name, so @Max Planck is not @Max', () => {
    expect(parseMentions('@Max Planck, over to you', members).members).toEqual([planck]);
    expect(parseMentions('@Max, over to you', members).members).toEqual([max]);
  });

  it('keeps order of appearance and names each member once', () => {
    const got = parseMentions('@Diplodoctor then @Ada then @diplodoctor again', members);
    expect(got.members).toEqual([diplo, ada]);
  });

  it('does not match an email address or a bare @', () => {
    expect(parseMentions('mail ada@example.com or @ nobody', members).members).toEqual([]);
  });

  it('does not match a longer word that begins with the name', () => {
    expect(parseMentions('@Adagio is a tempo', members).members).toEqual([]);
  });

  it('recognises @everyone', () => {
    const got = parseMentions('@everyone, status please', members);
    expect(got.everyone).toBe(true);
    expect(got.members).toEqual([]);
  });

  it('folds accents and punctuation in names', () => {
    expect(foldName('Zoë  Müller-Lüdenscheidt')).toBe('zoemullerludenscheidt');
    expect(handleOf('Legal eagle')).toBe('Legaleagle');
  });
});
