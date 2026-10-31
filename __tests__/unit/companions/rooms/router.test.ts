import { describe, expect, it } from 'vitest';
import {
  continuationPrompt,
  parseContinuation,
  parseRouterPick,
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
});
