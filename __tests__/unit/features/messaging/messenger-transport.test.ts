import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * OrangeCat's side of the packaged Messenger: what is asked of which route,
 * and what comes back in the Messenger's shapes. The screen is tested in the
 * package; this is the part only OrangeCat has.
 */

const db = vi.hoisted(() => {
  const calls: Array<{ table: string; op: string; args: unknown[] }> = [];
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const op of ['upsert', 'delete', 'eq']) {
      chain[op] = (...args: unknown[]) => {
        calls.push({ table, op, args });
        return chain;
      };
    }
    chain.then = (resolve: (value: unknown) => unknown) => resolve({ error: null });
    return chain;
  };
  return {
    calls,
    client: {
      from: (table: string) => builder(table),
      channel: () => ({ on: () => ({}), subscribe: () => ({}) }),
      removeChannel: vi.fn(),
    },
  };
});
vi.mock('@/lib/supabase/browser', () => ({ default: db.client }));

import { MessengerError } from '@bitbaum/chatkit/messenger';
import { createMessengerTransport } from '@/features/messaging/messenger-transport';

const fetchMock = vi.fn();
const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ success: true, data }), { status });
const refused = (status: number, message: string) =>
  new Response(JSON.stringify({ success: false, error: { message } }), { status });

beforeEach(() => {
  db.calls.length = 0;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const transport = (actor: string | null = null) =>
  createMessengerTransport({ userId: 'me', senderActorId: () => actor });

describe('sending', () => {
  it('posts the words, the client id and the uploads to the conversation', async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: 'srv-1', attachments: [] }, 201));
    const stored = await transport().send('c1', {
      clientId: 'tmp-1',
      body: 'hello',
      attachments: [],
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/messages/c1');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      content: 'hello',
      clientId: 'tmp-1',
      attachmentIds: [],
    });
    // The stored message carries the client id, so the bubble drawn at once
    // becomes this one and is not drawn twice.
    expect(stored).toMatchObject({
      id: 'srv-1',
      clientId: 'tmp-1',
      threadId: 'c1',
      authorId: 'me',
      body: 'hello',
    });
  });

  it('sends as the group the viewer chose, read at the moment of sending', async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: 'srv-1' }, 201));
    await transport('group-actor').send('c1', { clientId: 't', body: 'hi', attachments: [] });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).senderActorId).toBe('group-actor');
  });

  it('a photo alone goes out by its upload id, and comes back as the server stored it', async () => {
    const dto = {
      id: 'a1',
      kind: 'image',
      name: 'cat.jpg',
      mime_type: 'image/jpeg',
      bytes: 900,
      width: 10,
      height: 8,
      duration_ms: null,
      url: '/api/messages/attachments/a1',
      poster_url: null,
    };
    fetchMock.mockResolvedValueOnce(ok({ id: 'srv-2', attachments: [dto] }, 201));
    const stored = await transport().send('c1', {
      clientId: 't',
      body: '',
      attachments: [
        { id: 'a1', kind: 'image', name: 'cat.jpg', mimeType: 'image/jpeg', bytes: 1000, url: 'x' },
      ],
    });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).attachmentIds).toEqual(['a1']);
    expect(stored.attachments).toEqual([
      {
        id: 'a1',
        kind: 'image',
        name: 'cat.jpg',
        mimeType: 'image/jpeg',
        bytes: 900,
        width: 10,
        height: 8,
        durationMs: undefined,
        url: '/api/messages/attachments/a1',
        posterUrl: undefined,
      },
    ]);
  });

  it('a refusal the server worded reaches the person; a failure does not leak its details', async () => {
    fetchMock.mockResolvedValueOnce(refused(429, 'Rate limit exceeded. Please slow down.'));
    await expect(
      transport().send('c1', { clientId: 't', body: 'hi', attachments: [] })
    ).rejects.toBeInstanceOf(MessengerError);

    fetchMock.mockResolvedValueOnce(refused(500, 'relation "messages" does not exist'));
    const failure = await transport()
      .send('c1', { clientId: 't', body: 'hi', attachments: [] })
      .catch(error => error);
    expect(failure).not.toBeInstanceOf(MessengerError);
  });
});

describe('reading', () => {
  it('a page of messages comes back oldest first with the cursor for the page before', async () => {
    fetchMock.mockResolvedValueOnce(
      ok({
        conversation: {
          id: 'c1',
          is_group: false,
          title: null,
          participants: [],
          unread_count: 0,
          last_message_at: null,
          last_message_preview: null,
        },
        messages: [
          {
            id: 'm1',
            conversation_id: 'c1',
            sender_id: 'maya',
            content: 'hello',
            message_type: 'text',
            metadata: null,
            created_at: '2026-11-10T10:00:00Z',
            updated_at: '2026-11-10T10:00:00Z',
            is_deleted: false,
            edited_at: null,
          },
        ],
        pagination: { hasMore: true, nextCursor: '2026-11-10T10:00:00Z' },
      })
    );
    const page = await transport().messages('c1', { before: '2026-11-11T00:00:00Z' });
    expect(fetchMock.mock.calls[0]![0]).toBe(
      '/api/messages/c1?limit=50&cursor=2026-11-11T00%3A00%3A00Z'
    );
    expect(page.before).toBe('2026-11-10T10:00:00Z');
    expect(page.messages[0]).toMatchObject({ id: 'm1', threadId: 'c1', authorId: 'maya' });
    expect(page.messages[0]!.createdAt).toBeInstanceOf(Date);
  });

  it('the last page says there is nothing before it', async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ conversation: {}, messages: [], pagination: { hasMore: false, nextCursor: null } })
    );
    expect((await transport().messages('c1', {})).before).toBeNull();
  });

  it('marking read tells the server which conversation', async () => {
    fetchMock.mockResolvedValueOnce(ok({ success: true }));
    await transport().markRead!('c1', new Date());
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/messages/c1/read');
    expect(fetchMock.mock.calls[0]![1].method).toBe('POST');
  });
});

describe('typing', () => {
  it('upserts on the unique key with an expiry in the future, so repeats cannot duplicate a row', () => {
    const before = Date.now();
    transport().typing!('c1', true);
    const upsert = db.calls.find(c => c.op === 'upsert')!;
    expect(upsert.table).toBe('typing_indicators');
    const [row, options] = upsert.args as [Record<string, string>, { onConflict: string }];
    expect(row).toMatchObject({ conversation_id: 'c1', user_id: 'me' });
    expect(new Date(row.expires_at!).getTime()).toBeGreaterThan(before);
    expect(options.onConflict).toBe('conversation_id,user_id');
  });

  it('deletes its own row when typing stops, rather than writing a false flag', () => {
    transport().typing!('c1', false);
    expect(db.calls.map(c => [c.op, c.args])).toEqual([
      ['delete', []],
      ['eq', ['conversation_id', 'c1']],
      ['eq', ['user_id', 'me']],
    ]);
  });
});

describe('finding people', () => {
  it('searches profiles and never offers the viewer to themselves', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            { id: 'me', username: 'me', name: 'Me' },
            { id: 'ada', username: 'ada', name: 'Ada Okafor', avatar_url: null },
          ],
        })
      )
    );
    const people = await transport().people!('ada', {});
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/profiles?limit=20&search=ada');
    expect(people).toEqual([{ id: 'ada', name: 'Ada Okafor', handle: 'ada', avatarUrl: null }]);
  });
});

describe('bots beside people (ADR-0015)', () => {
  const json = (data: unknown) => new Response(JSON.stringify({ success: true, data }));

  it('offers the viewer’s own bots whose name matches, before the people', async () => {
    fetchMock
      .mockResolvedValueOnce(json([{ id: 'ada', username: 'ada', name: 'Ada Okafor' }]))
      .mockResolvedValueOnce(
        json([
          { id: 'b1', title: 'Ada the Accountant', avatar_url: '/a.svg' },
          { id: 'b2', title: 'Chef', avatar_url: null },
        ])
      );
    const people = await transport().people!('ada', {});
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/ai-assistants?limit=50&user_id=me');
    expect(people.map(p => p.id)).toEqual(['bot:b1', 'ada']);
    expect(people[0]).toMatchObject({ name: 'Ada the Accountant', kind: 'agent' });
  });

  it('opens a conversation with a bot by its companion, never as a person', async () => {
    fetchMock.mockResolvedValueOnce(ok({ conversationId: 'c9' })).mockResolvedValueOnce(
      ok({
        conversation: {
          id: 'c9',
          last_message_at: null,
          last_message_preview: null,
          unread_count: 0,
          participants: [],
        },
      })
    );
    await transport().open!(['bot:b1']);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/messages/open');
    expect(JSON.parse(init.body)).toEqual({ participantIds: [], assistantIds: ['b1'] });
  });

  it('says the bot is writing from the moment a message is sent to it', async () => {
    const seat = (user_id: string, is_agent = false) => ({
      user_id,
      username: user_id,
      name: user_id,
      avatar_url: null,
      role: 'member',
      joined_at: '2026-11-13T10:00:00Z',
      last_read_at: '',
      is_active: true,
      is_agent,
    });
    fetchMock
      .mockResolvedValueOnce(
        ok({
          conversation: {
            id: 'c1',
            last_message_at: null,
            last_message_preview: null,
            unread_count: 0,
            participants: [seat('me'), seat('seat-1', true)],
          },
        })
      )
      .mockResolvedValueOnce(ok({ id: 'srv-1', attachments: [] }, 201));
    const t = transport();
    const events: Array<{ type: string; actorId?: string; typing?: boolean }> = [];
    const stop = t.subscribe!({ conversationId: null }, e => events.push(e as never));
    await t.conversation!('c1', {});
    await t.send('c1', { clientId: 'tmp-1', body: 'hello', attachments: [] });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'typing', actorId: 'seat-1', typing: true })
    );
    stop();
  });

  it('says nothing of the kind in a conversation with a person', async () => {
    fetchMock.mockResolvedValueOnce(ok({ id: 'srv-1', attachments: [] }, 201));
    const t = transport();
    const events: Array<{ type: string }> = [];
    const stop = t.subscribe!({ conversationId: null }, e => events.push(e));
    await t.send('c2', { clientId: 'tmp-1', body: 'hello', attachments: [] });
    expect(events.filter(e => e.type === 'typing')).toEqual([]);
    stop();
  });
});
