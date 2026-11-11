import { describe, it, expect } from 'vitest';
import {
  MAX_BOT_TURNS,
  cutImpersonation,
  stripSelfPrefix,
  deriveRoomTitle,
  nextQueue,
  planResponders,
  sanitizeRound,
} from '@/services/companions/rooms/plan';
import type { RoomMember } from '@/services/companions/rooms/types';

const member = (id: string, name: string, position: number): RoomMember => ({
  id,
  kind: 'companion',
  assistantId: id,
  fleetSlug: null,
  name,
  job: null,
  avatarUrl: null,
  position,
});

const ada = member('a', 'Ada', 0);
const lex = member('l', 'Lex', 1);
const doc = member('d', 'Diplodoctor', 2);
const members = [ada, lex, doc];

describe('planResponders', () => {
  it('lets the addressed members speak, in the order addressed', () => {
    expect(planResponders({ text: '@Lex then @Ada', members }).queue).toEqual(['l', 'a']);
  });

  it('lets everyone speak on @everyone', () => {
    expect(planResponders({ text: '@everyone hello', members }).queue).toEqual(['a', 'l', 'd']);
  });

  it("takes the router's pick when nobody is addressed", () => {
    expect(planResponders({ text: 'is this a deadline?', members, routed: [lex] }).queue).toEqual([
      'l',
    ]);
  });

  it('never goes silent: without a pick the first member answers', () => {
    expect(planResponders({ text: 'hello', members, routed: [] }).queue).toEqual(['a']);
    expect(planResponders({ text: 'hello', members }).queue).toEqual(['a']);
  });

  it('opens a round with the full budget of turns', () => {
    expect(planResponders({ text: 'hi', members }).turnsLeft).toBe(MAX_BOT_TURNS);
  });
});

describe('nextQueue', () => {
  it('drops the speaker and queues whoever it addressed', () => {
    const state = { queue: ['a', 'l'], turnsLeft: 6 };
    const next = nextQueue({
      state,
      speaker: ada,
      reply: 'Done. @Diplodoctor, your turn.',
      members,
    });
    expect(next).toEqual({ queue: ['l', 'd'], turnsLeft: 5 });
  });

  it('never queues the speaker itself, and never a member twice', () => {
    const state = { queue: ['a', 'l'], turnsLeft: 6 };
    const next = nextQueue({ state, speaker: ada, reply: '@Ada @Lex @Lex', members });
    expect(next.queue).toEqual(['l']);
  });

  it('@everyone from a bot addresses every other member', () => {
    const next = nextQueue({
      state: { queue: ['a'], turnsLeft: 6 },
      speaker: ada,
      reply: '@everyone go',
      members,
    });
    expect(next.queue).toEqual(['l', 'd']);
  });

  it('ends the round when the turns are spent, whatever was asked', () => {
    const next = nextQueue({
      state: { queue: ['a'], turnsLeft: 1 },
      speaker: ada,
      reply: '@Lex @Diplodoctor',
      members,
    });
    expect(next).toEqual({ queue: [], turnsLeft: 0 });
  });

  it('two companions thanking each other stop within the budget', () => {
    let state = { queue: ['a'], turnsLeft: MAX_BOT_TURNS };
    let lines = 0;
    while (state.queue.length > 0 && lines < 100) {
      const speaker = members.find(m => m.id === state.queue[0])!;
      const other = speaker === ada ? lex : ada;
      state = nextQueue({ state, speaker, reply: `Thanks @${other.name}!`, members });
      lines++;
    }
    expect(lines).toBe(MAX_BOT_TURNS);
  });
});

describe('sanitizeRound', () => {
  it('keeps only real members, each once, within the turns left', () => {
    expect(sanitizeRound({ queue: ['x', 'l', 'l', 'a', 42], turnsLeft: 1 }, members)).toEqual({
      queue: ['l'],
      turnsLeft: 1,
    });
  });

  it('caps the turns at a round and treats garbage as nothing left', () => {
    expect(sanitizeRound({ queue: ['a'], turnsLeft: 99 }, members).turnsLeft).toBe(MAX_BOT_TURNS);
    expect(sanitizeRound({ queue: ['a'], turnsLeft: 'six' }, members)).toEqual({
      queue: [],
      turnsLeft: 0,
    });
    expect(sanitizeRound(null, members)).toEqual({ queue: [], turnsLeft: 0 });
  });
});

describe('deriveRoomTitle', () => {
  it('names a room after its members', () => {
    expect(deriveRoomTitle(['Ada', 'Lex', 'Diplodoctor'])).toBe('Ada, Lex & Diplodoctor');
    expect(deriveRoomTitle(['Ada', 'Lex'])).toBe('Ada & Lex');
    expect(deriveRoomTitle(['Ada'])).toBe('Ada');
    expect(deriveRoomTitle([])).toBe('Group chat');
  });
});

describe('cutImpersonation', () => {
  const [a, b] = members;
  it('cuts a staged dialogue where the other voice begins and hands over', () => {
    const reply = [
      'The client cannot keep the invoice.',
      '',
      'Discussion',
      `- **${b.name}:** From a medical standpoint the certificates suffice.`,
      `- **${a.name}:** I agree, a summary is enough.`,
      'Agreed plan: …',
    ].join('\n');
    const cut = cutImpersonation(reply, a, members);
    expect(cut.text).toBe('The client cannot keep the invoice.\n\nDiscussion');
    expect(cut.handoff?.id).toBe(b.id);
  });

  it('keeps one line addressed to another member: that is a question, not a staging', () => {
    const reply = `My view is X.\n${b.name}: what must the note contain?`;
    expect(cutImpersonation(reply, a, members)).toEqual({ text: reply, handoff: null });
  });

  it('leaves a name in the middle of a sentence, and a reply that opens in another voice, alone', () => {
    const mid = `As ${b.name} said, the note matters.\nI agree with ${b.name}: keep it short.`;
    expect(cutImpersonation(mid, a, members).handoff).toBeNull();
    const opens = `${b.name}: hello\n${a.name}: hi`;
    expect(cutImpersonation(opens, a, members)).toEqual({ text: opens, handoff: null });
  });
});

describe('stripSelfPrefix', () => {
  const [a] = members;
  it("drops the speaker's own name used as a label, and nothing else", () => {
    expect(stripSelfPrefix(`${a.name}: Two flaws.`, a)).toBe('Two flaws.');
    expect(stripSelfPrefix(`**${a.name}** — Two flaws.`, a)).toBe('Two flaws.');
    expect(stripSelfPrefix(`${a.name} thinks two flaws.`, a)).toBe(`${a.name} thinks two flaws.`);
    expect(stripSelfPrefix('Lex: hello', a)).toBe('Lex: hello');
  });
});
