import { describe, expect, it } from 'vitest';
import {
  toMessengerConversation,
  toMessengerMessage,
} from '@/features/messaging/lib/messenger-mapping';
import type { Conversation, Message, Participant } from '@/features/messaging/types';

/**
 * The translation between OrangeCat's rows and the packaged Messenger. Each
 * test is a judgement call that would silently change what people see.
 */

const participant = (overrides: Partial<Participant> = {}): Participant => ({
  user_id: 'maya',
  username: 'maya',
  name: 'Maya Keller',
  avatar_url: null,
  role: 'member',
  joined_at: '2026-11-01T00:00:00Z',
  last_read_at: '2026-11-10T10:00:00Z',
  is_active: true,
  ...overrides,
});

const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  id: 'c1',
  title: null,
  is_group: false,
  created_at: '2026-11-01T00:00:00Z',
  last_message_at: '2026-11-10T10:00:00Z',
  last_message_preview: 'See you there',
  last_message_sender_id: 'maya',
  participants: [participant({ user_id: 'me', username: 'me', name: 'Georgy' }), participant()],
  unread_count: 2,
  ...overrides,
});

const message = (overrides: Partial<Message> = {}): Message => ({
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
  ...overrides,
});

describe('a conversation, as the Messenger reads it', () => {
  it('marks the Cat as an agent and everyone else as a person', () => {
    const mapped = toMessengerConversation(
      conversation({
        participants: [
          participant(),
          participant({ user_id: 'cat', username: 'cat', name: 'Cat', is_agent: true }),
        ],
      })
    );
    expect(mapped.participants.map(p => [p.actorId, p.kind])).toEqual([
      ['maya', 'human'],
      ['cat', 'ai'],
    ]);
  });

  it('calls a direct conversation by the person, and a group by its name', () => {
    expect(
      toMessengerConversation(conversation({ title: 'Direct message' })).subject
    ).toBeUndefined();
    expect(
      toMessengerConversation(conversation({ is_group: true, title: '  Weekend hike ' })).subject
    ).toBe('Weekend hike');
  });

  it('shares the whole history with everyone in it', () => {
    const mapped = toMessengerConversation(conversation());
    expect(mapped.participants.every(p => p.visibleFrom === 'thread-start')).toBe(true);
  });

  it('someone who took it off their list loses their voice, not their place', () => {
    const mapped = toMessengerConversation(
      conversation({ participants: [participant({ is_active: false })] })
    );
    expect(mapped.participants[0]).toMatchObject({ actorId: 'maya', canWrite: false });
    expect(mapped.participants[0]).not.toHaveProperty('leftAt');
  });

  it('a conversation nobody has written in has no newest message', () => {
    const empty = toMessengerConversation(conversation({ last_message_preview: null }));
    expect(empty.last).toBeNull();
    const written = toMessengerConversation(conversation());
    expect(written.last).toEqual({
      body: 'See you there',
      authorId: 'maya',
      createdAt: '2026-11-10T10:00:00Z',
    });
    expect(written.unread).toBe(2);
  });

  it('falls back to the handle when someone has no name', () => {
    const mapped = toMessengerConversation(
      conversation({ participants: [participant({ name: '', username: 'user_4a12' })] })
    );
    expect(mapped.participants[0]!.name).toBe('user_4a12');
  });
});

describe('a message, as the Messenger reads it', () => {
  it('carries the client id that retires the bubble drawn at once', () => {
    expect(toMessengerMessage(message({ metadata: { client_id: 'tmp-1' } })).clientId).toBe(
      'tmp-1'
    );
    expect(toMessengerMessage(message())).not.toHaveProperty('clientId');
  });

  it('says whom the Cat answered for', () => {
    const mapped = toMessengerMessage(
      message({ sender_id: 'cat', metadata: { is_cat_reply: true, requested_by: 'me' } })
    );
    expect(mapped.onBehalfOf).toBe('me');
  });

  it('a message of only files has empty words and its files', () => {
    const mapped = toMessengerMessage(
      message({
        content: '',
        attachments: [
          {
            id: 'a1',
            kind: 'video',
            name: 'hike.mp4',
            mime_type: 'video/mp4',
            bytes: 9_000_000,
            width: 1280,
            height: 720,
            duration_ms: 42_000,
            url: '/api/messages/attachments/a1',
            poster_url: '/api/messages/attachments/a1?poster=1',
          },
        ],
      })
    );
    expect(mapped.body).toBe('');
    expect(mapped.attachments).toEqual([
      {
        id: 'a1',
        kind: 'video',
        name: 'hike.mp4',
        mimeType: 'video/mp4',
        bytes: 9_000_000,
        width: 1280,
        height: 720,
        durationMs: 42_000,
        url: '/api/messages/attachments/a1',
        posterUrl: '/api/messages/attachments/a1?poster=1',
      },
    ]);
  });

  it('keeps when it was edited', () => {
    expect(toMessengerMessage(message({ edited_at: '2026-11-10T11:00:00Z' })).editedAt).toBe(
      '2026-11-10T11:00:00Z'
    );
  });
});
