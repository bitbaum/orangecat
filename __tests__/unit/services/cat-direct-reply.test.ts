/**
 * Alone with the Cat, nothing has to tag it. The reply is worded for that
 * (nobody "tagged" anything) and carries no "for <person>": there is nobody
 * else it could have answered for. In company both stay as they were.
 */

const llm = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock('@/services/cat/platform-llm', () => ({
  callPlatformJson: llm.call,
  parseJsonLoose: (raw: string) => JSON.parse(raw),
}));
const written = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock('@/features/messaging/server/write-message', () => ({ writeMessage: written.write }));

import {
  buildPrompt,
  replyToConversationMention,
  systemPrompt,
} from '@/services/mentions/cat-reply';
import { isAloneWithCat } from '@/services/mentions/cat-direct';

function admin(members: string[]) {
  return {
    from: (table: string) => {
      if (table === 'conversation_participants') {
        return {
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({ data: members.map(user_id => ({ user_id })), error: null }),
            }),
          }),
          upsert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (_column: string, id: string) => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { username: id === 'cat-id' ? 'cat' : 'alice' },
                  error: null,
                }),
            }),
          }),
        };
      }
      // messages: the window the Cat reads.
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [
                      { sender_id: 'u1', content: 'hello', created_at: '2026-11-14T10:00:00Z' },
                    ],
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      };
    },
  } as never;
}

beforeEach(() => {
  llm.call.mockReset().mockResolvedValue('{"reply":"Hello."}');
  written.write.mockReset().mockResolvedValue('m-reply');
});

describe('isAloneWithCat', () => {
  it('is true for one person and the Cat, and for nothing else', async () => {
    await expect(isAloneWithCat(admin(['u1', 'cat-id']), 'c1', 'u1')).resolves.toBe(true);
    await expect(isAloneWithCat(admin(['u1', 'u2']), 'c1', 'u1')).resolves.toBe(false);
    await expect(isAloneWithCat(admin(['u1', 'u2', 'cat-id']), 'c1', 'u1')).resolves.toBe(false);
    await expect(isAloneWithCat(admin(['u1']), 'c1', 'u1')).resolves.toBe(false);
    // Somebody who is not in the conversation is not alone with anyone in it.
    await expect(isAloneWithCat(admin(['u2', 'cat-id']), 'c1', 'u1')).resolves.toBe(false);
  });
});

describe('the Cat’s reply', () => {
  it('alone with one person: told every message is for it, and answers for nobody else', async () => {
    await expect(
      replyToConversationMention(admin(['u1', 'cat-id']), {
        conversationId: 'c1',
        requesterId: 'u1',
        catId: 'cat-id',
      })
    ).resolves.toBe(true);
    const [system, prompt] = llm.call.mock.calls[0]!;
    expect(system).toContain('Every message here is written to you');
    expect(system).not.toContain('tagged');
    expect(prompt).toContain('Reply to their most recent message.');
    expect(written.write).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ senderId: 'cat-id', metadata: { is_cat_reply: true } })
    );
  });

  it('tagged among people: answers the tag, for the person who tagged it', async () => {
    await replyToConversationMention(admin(['u1', 'u2']), {
      conversationId: 'c1',
      requesterId: 'u1',
      catId: 'cat-id',
    });
    const [system, prompt] = llm.call.mock.calls[0]!;
    expect(system).toContain('You were tagged with @cat');
    expect(prompt).toContain('most recent message that tagged @cat');
    expect(written.write).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ metadata: { is_cat_reply: true, requested_by: 'u1' } })
    );
  });

  it('the two wordings are the two the code can ask for', () => {
    expect(systemPrompt(true)).not.toBe(systemPrompt(false));
    expect(buildPrompt([], 'u1', 'cat-id')).toContain('tagged');
    expect(buildPrompt([], 'u1', 'cat-id', true)).not.toContain('tagged');
  });
});
