import { describe, expect, it, vi } from 'vitest';
import { catConversationStore } from '@/lib/chat/cat-conversation-store';
import { catAnswer, catMessageFromRow } from '@/lib/chat/cat-messages';

/**
 * The Cat's chats behind chatkit's ChatApp: its six-method store over the
 * Cat's own routes, and the turns it reads back in the same shape a turn
 * that just streamed in has.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('catConversationStore', () => {
  it('lists the rows with readable titles, newest first as the server sends them', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      json({
        success: true,
        data: {
          conversations: [
            {
              id: 'a',
              title: 'sell this <attached_image name="x.jpg"/>',
              updated_at: '2026-10-27T10:00:00Z',
            },
            { id: 'b', title: null, updated_at: '2026-10-26T10:00:00Z' },
          ],
        },
      })
    );
    const list = await catConversationStore(fetcher).list();
    expect(fetcher).toHaveBeenCalledWith('/api/cat/conversations');
    expect(list).toEqual([
      { id: 'a', title: 'sell this', updatedAt: '2026-10-27T10:00:00Z' },
      { id: 'b', title: '', updatedAt: '2026-10-26T10:00:00Z' },
    ]);
  });

  it('reads a chat back, and says it is gone on a 404', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          success: true,
          data: [
            { id: 'm1', role: 'user', content: 'hi', created_at: '2026-10-27T10:00:00Z' },
            { id: 'm2', role: 'assistant', content: 'Hello', created_at: '2026-10-27T10:00:01Z' },
          ],
        })
      )
      .mockResolvedValueOnce(json({ success: false }, 404));
    const store = catConversationStore(fetcher);
    const chat = await store.get('a');
    expect(chat?.messages.map(m => [m.role, m.content])).toEqual([
      ['user', 'hi'],
      ['assistant', 'Hello'],
    ]);
    expect(await store.get('gone')).toBeNull();
  });

  it('creates, renames and deletes through the Cat routes; never writes a turn itself', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ success: true, data: { id: 'new' } }))
      .mockResolvedValueOnce(json({ success: true, data: { success: true } }))
      .mockResolvedValueOnce(json({ success: false }, 404));
    const store = catConversationStore(fetcher);
    expect(await store.create({ title: 'Plan a trip' })).toMatchObject({
      id: 'new',
      title: 'Plan a trip',
    });
    await store.append('new', { id: 'x', role: 'user', content: 'not sent anywhere' });
    await store.rename('new', 'Trip');
    await store.remove('new'); // already gone is fine
    expect(fetcher.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['/api/cat/conversations', 'POST'],
      ['/api/cat/conversations/new', 'PATCH'],
      ['/api/cat/conversations/new', 'DELETE'],
    ]);
  });
});

describe('catAnswer', () => {
  it('drops the card fences and the replies block from the words', () => {
    const answer = catAnswer({
      content:
        'Done.\n\n```exec_action\n{"actionId":"x"}\n```\n\n```quick_replies\n["Show me", "Not now"]\n```',
    });
    expect(answer.content).toBe('Done.');
    expect(answer.replies).toEqual(['Show me', 'Not now']);
  });

  it('turns cited sources into chatkit citations', () => {
    const answer = catAnswer({
      content: 'Rent is 240 CHF [F1].',
      toolCalls: [
        {
          id: 't1',
          name: 'web_search',
          status: 'completed',
          resultCount: 1,
          results: [{ handle: 'F1', url: 'https://example.com/rent', title: 'Rents' }],
        } as never,
      ],
    });
    expect(answer.citations).toEqual({
      F1: { label: 'Rents', detail: 'https://example.com/rent', href: 'https://example.com/rent' },
    });
  });

  it('reads a stored answer the same way it streamed in', () => {
    const row = catMessageFromRow({
      id: 'm',
      role: 'assistant',
      content: 'Hi',
      created_at: '2026-10-27T10:00:00Z',
      model_used: 'auto',
      tool_calls: null,
    });
    expect(row).toMatchObject({ id: 'm', role: 'assistant', content: 'Hi', modelUsed: 'auto' });
  });
});
