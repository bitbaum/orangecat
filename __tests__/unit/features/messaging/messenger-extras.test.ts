/**
 * What a message carries besides words and files, as the Messenger reads it:
 * the message it answers, the reactions on it, a payment request. And the
 * rule that only the server writes those keys of messages.metadata.
 */
import {
  toMessengerMessage,
  toPaymentRequestCard,
} from '@/features/messaging/lib/messenger-mapping';
import { excerpt, replyOf, withoutServerKeys } from '@/features/messaging/server/extras';
import { payablePerson } from '@/features/messaging/money-actions';
import { sendMessageSchema } from '@/features/messaging/lib/send-message-schema';
import type { Message, MessagePaymentRequestDto } from '@/features/messaging/types';

vi.mock('@/lib/supabase/untyped', () => ({ fromTable: vi.fn() }));

const message = (extra: Partial<Message> = {}): Message => ({
  id: 'm1',
  conversation_id: 'c1',
  sender_id: 'maya',
  content: 'Hello',
  message_type: 'text',
  metadata: null,
  created_at: '2026-11-13T10:00:00Z',
  updated_at: '2026-11-13T10:00:00Z',
  is_deleted: false,
  edited_at: null,
  sender: { id: 'maya', username: 'maya', name: 'Maya', avatar_url: null },
  ...extra,
});

const request = (extra: Partial<MessagePaymentRequestDto> = {}): MessagePaymentRequestDto => ({
  id: '11111111-1111-4111-8111-111111111111',
  requester_id: 'maya',
  payer_id: 'me',
  amount_btc: 0.0002,
  ask_amount: 12,
  ask_currency: 'CHF',
  note: 'Zoo tickets',
  status: 'pending',
  ...extra,
});

describe('a reply', () => {
  it('reaches the Messenger as the quote stored when it was sent', () => {
    const mapped = toMessengerMessage(
      message({ reply_to: { id: 'm0', sender_id: 'me', body: 'Shall we?', kinds: ['image'] } })
    );
    expect(mapped.replyTo).toEqual({
      id: 'm0',
      authorId: 'me',
      body: 'Shall we?',
      attachments: ['image'],
    });
  });

  it('is read from metadata only when it is well formed', () => {
    expect(replyOf({ reply_to: { id: 'm0', sender_id: 'me', body: 'x' } })).toEqual({
      id: 'm0',
      sender_id: 'me',
      body: 'x',
    });
    expect(replyOf({ reply_to: { id: 5 } })).toBeNull();
    expect(replyOf(null)).toBeNull();
  });

  it('quotes one line, cut at 140 characters', () => {
    expect(excerpt('one\n two   three')).toBe('one two three');
    const cut = excerpt('x'.repeat(300));
    expect(cut).toHaveLength(140);
    expect(cut.endsWith('…')).toBe(true);
  });
});

describe('reactions', () => {
  it('reach the Messenger with who put each one there', () => {
    const mapped = toMessengerMessage(
      message({ reactions: [{ emoji: '👍', user_ids: ['me', 'ben'] }] })
    );
    expect(mapped.reactions).toEqual([{ emoji: '👍', actorIds: ['me', 'ben'] }]);
    expect(toMessengerMessage(message({ reactions: [] }))).not.toHaveProperty('reactions');
  });
});

describe('a payment request in a conversation', () => {
  it('offers the person asked one thing: pay it, tied to the request', () => {
    const card = toPaymentRequestCard(request(), 'me', 'maya');
    expect(card.amount).toContain('12');
    expect(card.note).toBe('Zoo tickets');
    expect(card.action?.label).toContain('Pay');
    expect(card.action?.href).toMatch(/^\/pay\/maya\?/);
    expect(card.action?.href).toContain('request=11111111-1111-4111-8111-111111111111');
  });

  it('tells the person asking where it stands, and offers them nothing to pay', () => {
    const card = toPaymentRequestCard(request(), 'maya', 'maya');
    expect(card.action).toBeUndefined();
    expect(card.status).toBe('Waiting to be paid');
  });

  it('never offers to pay a request that is no longer open', () => {
    for (const status of ['paid', 'declined', 'cancelled'] as const) {
      const card = toPaymentRequestCard(request({ status }), 'me', 'maya');
      expect(card.action).toBeUndefined();
      expect(card.status).toBeTruthy();
    }
    expect(toPaymentRequestCard(request({ status: 'paid' }), 'me', 'maya').status).toBe('Paid');
  });

  it('shows a request made in Bitcoin in Bitcoin', () => {
    const card = toPaymentRequestCard(
      request({ ask_amount: null, ask_currency: null, amount_btc: 0.001 }),
      'maya',
      'maya'
    );
    expect(card.amount).toContain('BTC');
  });

  it('is a message with no words', () => {
    const ok = sendMessageSchema.safeParse({
      content: '',
      paymentRequestId: '11111111-1111-4111-8111-111111111111',
    });
    expect(ok.success).toBe(true);
    expect(sendMessageSchema.safeParse({ content: '' }).success).toBe(false);
  });
});

describe('metadata only the server writes', () => {
  it('drops a client’s own reply, payment request and client id', () => {
    expect(
      withoutServerKeys({
        reply_to: { id: 'x', sender_id: 'someone', body: 'words they never said' },
        payment_request_id: 'not-mine',
        client_id: 'spoof',
        theme: 'kept',
      })
    ).toEqual({ theme: 'kept' });
  });
});

describe('who can be paid from a conversation', () => {
  const seat = (actorId: string, extra: Record<string, unknown> = {}) => ({
    actorId,
    kind: 'human' as const,
    name: actorId,
    handle: actorId,
    joinedAt: new Date(),
    ...extra,
  });
  const conversation = (participants: ReturnType<typeof seat>[]) =>
    ({ id: 'c', createdAt: new Date(), participants }) as never;

  it('the one other person in a direct conversation', () => {
    expect(payablePerson(conversation([seat('me'), seat('maya')]), 'me')?.handle).toBe('maya');
  });

  it('not an agent, not a group, not somebody without a handle', () => {
    expect(payablePerson(conversation([seat('me'), seat('cat', { kind: 'ai' })]), 'me')).toBeNull();
    expect(payablePerson(conversation([seat('me'), seat('a'), seat('b')]), 'me')).toBeNull();
    expect(
      payablePerson(conversation([seat('me'), seat('x', { handle: undefined })]), 'me')
    ).toBeNull();
  });
});
