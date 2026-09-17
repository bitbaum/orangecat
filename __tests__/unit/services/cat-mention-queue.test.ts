/**
 * The queue is what turns "someone tagged the Cat" into a promise that gets
 * kept. Its two load-bearing properties are both about not losing or repeating
 * a question, and neither is visible in a happy-path test.
 *
 * The dedupe key is the sharpest of them. It must be the MESSAGE id: keying on
 * the conversation would mean the first question ever asked there is the only
 * one answered, because every later insert collides with the unique constraint
 * and is treated as already queued. That bug was written and caught here.
 */

import { enqueueMention, failMention, MAX_ATTEMPTS } from '@/services/mentions/queue';
import { noteCatMention } from '@/services/mentions/note-mention';

function adminSpy(opts: { insertError?: { code?: string; message: string } } = {}) {
  const insert = vi.fn().mockResolvedValue({ error: opts.insertError ?? null });
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  const admin = { from: () => ({ insert, update }) };
  return { admin: admin as never, insert, update };
}

describe('enqueueMention', () => {
  it('records the debt', async () => {
    const { admin, insert } = adminSpy();
    await expect(
      enqueueMention(admin, {
        sourceType: 'message',
        sourceId: 'm1',
        requesterId: 'u1',
        conversationId: 'c1',
      })
    ).resolves.toBe(true);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ source_id: 'm1' }));
  });

  it('treats a duplicate as success, because that is what makes retries safe', async () => {
    // 23505 = unique violation. An at-least-once producer firing twice must not
    // look like a failure, or the caller retries forever.
    const { admin } = adminSpy({ insertError: { code: '23505', message: 'duplicate key' } });
    await expect(
      enqueueMention(admin, {
        sourceType: 'message',
        sourceId: 'm1',
        requesterId: 'u1',
        conversationId: 'c1',
      })
    ).resolves.toBe(true);
  });

  it('reports a real failure as a failure', async () => {
    const { admin } = adminSpy({ insertError: { code: '42P01', message: 'no such table' } });
    await expect(
      enqueueMention(admin, {
        sourceType: 'message',
        sourceId: 'm1',
        requesterId: 'u1',
        conversationId: 'c1',
      })
    ).resolves.toBe(false);
  });
});

describe('failMention', () => {
  it('returns the mention to pending while attempts remain', async () => {
    const { admin, update } = adminSpy();
    await failMention(admin, { attempts: 1 } as never, 'timeout');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
  });

  it('abandons it once attempts are exhausted, keeping the reason', async () => {
    const { admin, update } = adminSpy();
    await failMention(admin, { attempts: MAX_ATTEMPTS } as never, 'model unreachable');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', last_error: 'model unreachable' })
    );
  });
});

describe('noteCatMention', () => {
  /** Resolver + profile lookup + insert, in the shape the service chains them. */
  function admin({ username = 'alice', mentionsCat = true } = {}) {
    const insert = vi.fn().mockResolvedValue({ error: null });
    return {
      insert,
      client: {
        from: (table: string) => {
          if (table === 'mention_queue') {
            return { insert };
          }
          return {
            select: () => ({
              in: () => ({
                limit: () =>
                  Promise.resolve({
                    data: mentionsCat ? [{ id: 'cat-id', username: 'cat' }] : [],
                    error: null,
                  }),
              }),
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { username }, error: null }),
              }),
            }),
          };
        },
      } as never,
    };
  }

  it('queues a reply keyed on the MESSAGE, so a second question is also answered', async () => {
    const { client, insert } = admin();
    await noteCatMention(client, {
      conversationId: 'c1',
      messageId: 'm2',
      senderId: 'u1',
      content: '@cat and this?',
    });
    // Keyed on the conversation, this row would collide with the first question
    // ever asked in c1 and be silently dropped.
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ source_id: 'm2' }));
  });

  it('skips messages with no @ at all without touching the database', async () => {
    const { client, insert } = admin();
    const noted = await noteCatMention(client, {
      conversationId: 'c1',
      messageId: 'm1',
      senderId: 'u1',
      content: 'just talking',
    });
    expect(noted).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it('does not let the Cat answer itself', async () => {
    // A Cat reply that happened to contain the handle would otherwise queue
    // another reply, forever.
    const { client, insert } = admin({ username: 'cat' });
    const noted = await noteCatMention(client, {
      conversationId: 'c1',
      messageId: 'm1',
      senderId: 'cat-id',
      content: 'as @cat I think',
    });
    expect(noted).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it('ignores a message that mentions someone else', async () => {
    const { client, insert } = admin({ mentionsCat: false });
    const noted = await noteCatMention(client, {
      conversationId: 'c1',
      messageId: 'm1',
      senderId: 'u1',
      content: 'hey @alice',
    });
    expect(noted).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it('never throws — a person’s message must be stored whatever the Cat does', async () => {
    const exploding = {
      from: () => {
        throw new Error('db down');
      },
    } as never;
    await expect(
      noteCatMention(exploding, {
        conversationId: 'c1',
        messageId: 'm1',
        senderId: 'u1',
        content: '@cat hi',
      })
    ).resolves.toBe(false);
  });
});
