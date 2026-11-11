import { describe, expect, it } from 'vitest';
import {
  continuationPrompt,
  parseContinuation,
  parseRouterPick,
  routerPrompt,
} from '@/services/companions/rooms/router';
import type { RoomMember } from '@/services/companions/rooms/types';

const member = (id: string, name: string, job: string | null): RoomMember => ({
  id,
  kind: 'fleet',
  assistantId: null,
  fleetSlug: id,
  name,
  job,
  avatarUrl: null,
  position: 0,
});
const diplo = member('d', 'Diplodoctor', 'health');
const causius = member('c', 'Causius', 'legal');
const members = [diplo, causius];

describe('parseContinuation', () => {
  it('names the member who should speak next, never the one who just did', () => {
    expect(parseContinuation('Causius', diplo, members)?.id).toBe('c');
    expect(parseContinuation('@causius\n', diplo, members)?.id).toBe('c');
    expect(parseContinuation('Diplodoctor', diplo, members)).toBeNull();
  });

  it('reads done, an unknown name and nothing as the round being over', () => {
    expect(parseContinuation('done', diplo, members)).toBeNull();
    expect(parseContinuation('Done.', diplo, members)).toBeNull();
    expect(parseContinuation('Loki', diplo, members)).toBeNull();
    expect(parseContinuation('', diplo, members)).toBeNull();
  });

  it('asks for one word and lists the members', () => {
    const prompt = continuationPrompt(members);
    expect(prompt).toContain('- Diplodoctor: health');
    expect(prompt).toContain('"done"');
    expect(prompt).toContain('another member’s job and that member has not spoken yet');
    expect(prompt).toContain('another member’s job and that member has not spoken yet');
  });
});

describe('parseRouterPick', () => {
  it('takes handles only, each once, at most two', () => {
    expect(parseRouterPick('causius\n@Diplodoctor\ncausius\nloki', members).map(m => m.id)).toEqual(
      ['c', 'd']
    );
  });

  it('reads a verdict per member: yes picks, no skips, in the order written', () => {
    expect(parseRouterPick('Causius: yes\nDiplodoctor: yes', members).map(m => m.id)).toEqual([
      'c',
      'd',
    ]);
    expect(parseRouterPick('Diplodoctor: no\nCausius: yes', members).map(m => m.id)).toEqual(['c']);
    expect(parseRouterPick('- diplodoctor: No.\n- causius: no', members)).toEqual([]);
    expect(
      parseRouterPick('Diplodoctor: yes, the cold\nLoki: yes', members).map(m => m.id)
    ).toEqual(['d']);
  });

  it('asks for a verdict per member, by name', () => {
    const prompt = routerPrompt(members);
    expect(prompt).toContain('Diplodoctor: yes or no');
    expect(prompt).toContain('Causius: yes or no');
    expect(prompt).toContain('nobody answers in another’s place');
  });
});
