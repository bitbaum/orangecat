/**
 * Who a message is owed an answer from, and what that bot is given
 * (ADR-0015 D3, D4, D6). The tables are faked; the rules are the real ones.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const tables: Record<string, unknown[]> = {};
  const filters: Array<{ table: string; op: string; args: unknown[] }> = [];
  const fromTable = (_admin: unknown, table: string) => {
    const chain: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'in', 'is', 'gte', 'order', 'limit']) {
      chain[op] = (...args: unknown[]) => {
        filters.push({ table, op, args });
        return chain;
      };
    }
    chain.maybeSingle = async () => ({ data: (tables[table] ?? [])[0] ?? null, error: null });
    chain.then = (resolve: (value: unknown) => unknown) =>
      resolve({ data: tables[table] ?? [], error: null });
    return chain;
  };
  return { tables, filters, fromTable };
});
vi.mock('@/lib/supabase/untyped', () => ({ fromTable: db.fromTable }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));

const companionAnswer = vi.hoisted(() => vi.fn());
vi.mock('@/services/companions/answer', () => ({ companionAnswer }));
const writeMessage = vi.hoisted(() => vi.fn(async () => 'new-message'));
vi.mock('@/features/messaging/server/write-message', () => ({ writeMessage }));

import { answerAsBot, groupScene, transcriptForSeat } from '@/features/messaging/server/bot-answer';
import { MAX_BOTS_PER_MESSAGE, namedBots } from '@/features/messaging/lib/named-bots';

const admin = {} as never;
const seat = (user_id: string, assistant_id: string | null) => ({ user_id, assistant_id });
const member = (user_id: string, joined_at = '2026-11-13T09:00:00Z') => ({ user_id, joined_at });
const profile = (id: string, name: string) => ({ id, name, username: id });

function conversation(input: {
  members: ReturnType<typeof member>[];
  seats: ReturnType<typeof seat>[];
  profiles: ReturnType<typeof profile>[];
  messages: Array<{ sender_id: string; content: string }>;
  companion?: { status: string; is_public: boolean; user_id: string };
}) {
  db.tables.conversation_participants = input.members;
  db.tables.companion_seats = input.seats;
  db.tables.profiles = input.profiles;
  // Newest first, as the query orders them.
  db.tables.messages = [...input.messages].reverse();
  db.tables.ai_assistants = input.companion ? [input.companion] : [];
}

beforeEach(() => {
  for (const key of Object.keys(db.tables)) {
    delete db.tables[key];
  }
  db.filters.length = 0;
  companionAnswer.mockReset();
  companionAnswer.mockResolvedValue({ content: 'An answer.', settle: vi.fn() });
  writeMessage.mockClear();
});

describe('one person and one bot', () => {
  it('every message is answered, with what the bot remembers about that person', async () => {
    conversation({
      members: [member('me'), member('s1')],
      seats: [seat('s1', 'a1')],
      profiles: [profile('me', 'Georgy'), profile('s1', 'Chef')],
      messages: [{ sender_id: 'me', content: 'What is for dinner?' }],
    });
    const written = await answerAsBot(admin, {
      conversationId: 'c',
      senderId: 'me',
      content: 'What is for dinner?',
    });
    expect(written).toBe(1);
    const asked = companionAnswer.mock.calls[0]![0];
    expect(asked).toMatchObject({ userId: 'me', assistantId: 'a1', recall: true });
    // No names in front of the lines: there is only one other voice.
    expect(asked.content).toBe('What is for dinner?');
    expect(writeMessage.mock.calls[0]![1]).toMatchObject({
      senderId: 's1',
      content: 'An answer.',
      metadata: { is_bot_reply: true },
    });
  });
});

describe('a bot in a group of people', () => {
  const group = (extra: Partial<Parameters<typeof conversation>[0]> = {}) =>
    conversation({
      members: [member('me'), member('maya'), member('s1', '2026-11-13T10:00:00Z')],
      seats: [seat('s1', 'a1')],
      profiles: [profile('me', 'Georgy'), profile('maya', 'Maya'), profile('s1', 'Chef')],
      messages: [
        { sender_id: 'maya', content: 'I am hungry' },
        { sender_id: 'me', content: '@Chef what is quick?' },
      ],
      companion: { status: 'active', is_public: false, user_id: 'me' },
      ...extra,
    });

  it('says nothing when it is not named', async () => {
    group();
    expect(
      await answerAsBot(admin, { conversationId: 'c', senderId: 'me', content: 'Any ideas?' })
    ).toBe(0);
    expect(companionAnswer).not.toHaveBeenCalled();
    expect(writeMessage).not.toHaveBeenCalled();
  });

  it('answers when named: for the asker, without private memories, knowing who said what', async () => {
    group();
    const written = await answerAsBot(admin, {
      conversationId: 'c',
      senderId: 'me',
      content: '@Chef what is quick?',
    });
    expect(written).toBe(1);
    const asked = companionAnswer.mock.calls[0]![0];
    expect(asked.recall).toBe(false);
    expect(asked.history).toEqual([{ role: 'user', content: 'Maya: I am hungry' }]);
    expect(asked.content).toBe('Georgy: @Chef what is quick?');
    expect(asked.scene('Be a chef.')).toContain('Georgy named you');
    expect(writeMessage.mock.calls[0]![1].metadata).toEqual({
      is_bot_reply: true,
      requested_by: 'me',
    });
  });

  it('reads from the moment it was added, not what was said before', async () => {
    group();
    await answerAsBot(admin, { conversationId: 'c', senderId: 'me', content: '@Chef hello' });
    expect(db.filters).toContainEqual({
      table: 'messages',
      op: 'gte',
      args: ['created_at', '2026-11-13T10:00:00Z'],
    });
  });

  it('a private bot tells somebody who is not its owner so, and no model is asked', async () => {
    group();
    const written = await answerAsBot(admin, {
      conversationId: 'c',
      senderId: 'maya',
      content: '@Chef and for me?',
    });
    expect(written).toBe(1);
    expect(companionAnswer).not.toHaveBeenCalled();
    expect(writeMessage.mock.calls[0]![1].content).toBe(
      'Chef answers only the person who brought it into this conversation.'
    );
  });

  it('a bot’s own line is never owed an answer, so two bots cannot keep each other talking', async () => {
    group();
    expect(
      await answerAsBot(admin, { conversationId: 'c', senderId: 's1', content: '@Chef again' })
    ).toBe(0);
    expect(companionAnswer).not.toHaveBeenCalled();
  });

  it('a bot that cannot answer says why in its place', async () => {
    group();
    companionAnswer.mockResolvedValue({
      error: { code: 'RATE_LIMITED', message: 'Daily limit reached.' },
    });
    await answerAsBot(admin, { conversationId: 'c', senderId: 'me', content: '@Chef hi' });
    expect(writeMessage.mock.calls[0]![1].content).toBe('Daily limit reached.');
  });
});

describe('naming a bot', () => {
  const bots = [{ name: 'Chef' }, { name: 'Legal Eagle' }, { name: 'Max' }, { name: 'Max Planck' }];

  it('by @name, with or without the spaces, whatever the case', () => {
    expect(namedBots('@chef what now', bots).map(b => b.name)).toEqual(['Chef']);
    expect(namedBots('ask @LegalEagle', bots).map(b => b.name)).toEqual(['Legal Eagle']);
    expect(namedBots('ask @legal eagle', bots).map(b => b.name)).toEqual(['Legal Eagle']);
  });

  it('the longest name wins, and a word in a sentence is not a call', () => {
    expect(namedBots('@Max Planck, a question', bots).map(b => b.name)).toEqual(['Max Planck']);
    expect(namedBots('the chef at that place was good', bots)).toEqual([]);
    expect(namedBots('mail me at chef@example.org', bots)).toEqual([]);
  });

  it('one message calls on a few bots at most', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ name: `Bot${i}` }));
    const called = namedBots(many.map(b => `@${b.name}`).join(' '), many);
    expect(called).toHaveLength(MAX_BOTS_PER_MESSAGE);
  });
});

describe('what a bot in a group is given', () => {
  it('every line that is not its own starts with who wrote it', () => {
    const names = new Map([
      ['me', 'Georgy'],
      ['maya', 'Maya'],
    ]);
    expect(
      transcriptForSeat(
        [
          { sender_id: 'maya', content: 'Hi' },
          { sender_id: 'seat', content: 'Hello.' },
          { sender_id: 'me', content: 'Go on' },
        ],
        'seat',
        names
      )
    ).toEqual([
      { role: 'user', content: 'Maya: Hi' },
      { role: 'assistant', content: 'Hello.' },
      { role: 'user', content: 'Georgy: Go on' },
    ]);
  });

  it('is told who is there, who named it, and to speak only as itself', () => {
    const scene = groupScene('Be a chef.', {
      name: 'Chef',
      asker: 'Georgy',
      others: ['Georgy', 'Maya'],
    });
    expect(scene.startsWith('Be a chef.')).toBe(true);
    expect(scene).toContain('Georgy, Maya');
    expect(scene).toContain('Never write a line for anybody else');
  });
});
