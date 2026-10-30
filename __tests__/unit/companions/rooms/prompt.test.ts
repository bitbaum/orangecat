import { describe, it, expect } from 'vitest';
import {
  ROOM_HISTORY,
  ROOM_SECTION_HEADING,
  buildRoomPrompt,
  splitForModel,
  transcriptFor,
} from '@/services/companions/rooms/prompt';
import { parseRouterPick, routerPrompt } from '@/services/companions/rooms/router';
import type { RoomMember, RoomMessage } from '@/services/companions/rooms/types';

const member = (id: string, name: string, job: string | null = null): RoomMember => ({
  id,
  kind: 'companion',
  assistantId: id,
  fleetSlug: null,
  name,
  job,
  avatarUrl: null,
  position: 0,
});

const ada = member('a', 'Ada', 'Keeps the books');
const lex = member('l', 'Legal eagle', 'Reads contracts');
const members = [ada, lex];

describe('buildRoomPrompt', () => {
  it('keeps the definition first and adds the room under it', () => {
    const prompt = buildRoomPrompt({ speaker: ada, members, definition: 'You are Ada.' });
    expect(prompt.startsWith('You are Ada.')).toBe(true);
    expect(prompt).toContain(ROOM_SECTION_HEADING);
    expect(prompt).toContain('- @Legaleagle — Reads contracts');
    expect(prompt).not.toContain('- @Ada');
    expect(prompt).toContain('Speak as Ada only');
  });

  it('stands alone when the companion has no definition (a fleet bot)', () => {
    const prompt = buildRoomPrompt({ speaker: lex, members, definition: null });
    expect(prompt.startsWith(ROOM_SECTION_HEADING)).toBe(true);
  });
});

describe('transcriptFor', () => {
  const msg = (partial: Partial<RoomMessage> & { content: string }): RoomMessage => ({
    id: Math.random().toString(36),
    role: 'user',
    memberId: null,
    speaker: null,
    createdAt: '2026-10-30T00:00:00Z',
    ...partial,
  });

  it('casts the person as user, the speaker as assistant, the others as named user lines', () => {
    const messages = [
      msg({ content: 'Hello both' }),
      msg({ role: 'assistant', memberId: 'a', speaker: 'Ada', content: 'Hi!' }),
      msg({ role: 'assistant', memberId: 'l', speaker: 'Legal eagle', content: 'Good day.' }),
    ];
    expect(transcriptFor(messages, ada)).toEqual([
      { role: 'user', content: 'Hello both' },
      { role: 'assistant', content: 'Hi!' },
      { role: 'user', content: 'Legal eagle: Good day.' },
    ]);
  });

  it('shows only the last lines', () => {
    const messages = Array.from({ length: ROOM_HISTORY + 5 }, (_, i) => msg({ content: `m${i}` }));
    const got = transcriptFor(messages, ada);
    expect(got).toHaveLength(ROOM_HISTORY);
    expect(got[0].content).toBe('m5');
  });
});

describe('splitForModel', () => {
  it('ends the history on the last user line', () => {
    expect(
      splitForModel([
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
        { role: 'user', content: 'c' },
      ])
    ).toEqual({
      history: [
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
      ],
      content: 'c',
    });
  });

  it('asks the speaker to go on when it spoke last', () => {
    expect(splitForModel([{ role: 'assistant', content: 'b' }]).content).toBe('Go on.');
  });
});

describe('router', () => {
  it('names the members and their jobs', () => {
    const prompt = routerPrompt(members);
    expect(prompt).toContain('- Ada: Keeps the books');
    expect(prompt).toContain('- Legaleagle: Reads contracts');
  });

  it('reads handles back, ignoring decoration, unknown names and extras', () => {
    expect(parseRouterPick('- @Legaleagle\nAda\nNobody\n', members)).toEqual([lex, ada]);
    expect(parseRouterPick('legal eagle', members)).toEqual([]);
    expect(parseRouterPick('ada, ada, ada', members)).toEqual([ada]);
    expect(parseRouterPick('', members)).toEqual([]);
  });
});
