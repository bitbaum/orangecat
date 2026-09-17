/**
 * Messaging correctness, after delegating authorization/read/merge to threadkit.
 *
 * Every test below fails against the implementation this replaced. They are
 * written as the three defects they cover, not as coverage of the new code:
 *
 *   1. "read" was claimed when ANY recipient had caught up — wrong from three
 *      participants upward, and invisible with two, which is why it survived.
 *   2. a reader was counted even when the message sat outside their visibility.
 *   3. an optimistic bubble and its stored row shared no identity, so a realtime
 *      INSERT arriving before the write's own response rendered both.
 */

import { describe, expect, it } from 'vitest';
import { readersOf } from 'threadkit';

import {
  applyStatusToMessages,
  calculateMessageStatus,
  createOptimisticMessage,
  isOptimisticMessage,
  mergeMessages,
  readerCount,
} from '@/features/messaging/lib/message-utils';
import {
  clientIdOf,
  toThread,
  toThreadMessage,
  toThreadParticipant,
} from '@/features/messaging/lib/threadkit-adapter';
import { MESSAGE_STATUS } from '@/features/messaging/lib/constants';
import type { Message, Participant } from '@/features/messaging/types';

const CONVERSATION = 'conv-1';
const ME = 'user-me';
const ALICE = 'user-alice';
const BOB = 'user-bob';

const AT = (iso: string) => new Date(iso);

function message(
  over: Partial<Message> & Pick<Message, 'id' | 'sender_id' | 'created_at'>
): Message {
  return {
    conversation_id: CONVERSATION,
    content: 'hello',
    message_type: 'text',
    metadata: null,
    updated_at: over.created_at,
    is_deleted: false,
    edited_at: null,
    ...over,
  };
}

function participant(over: Partial<Participant> & Pick<Participant, 'user_id'>): Participant {
  return {
    username: over.user_id,
    name: '',
    avatar_url: null,
    role: 'member',
    joined_at: '2026-01-01T00:00:00.000Z',
    last_read_at: '',
    is_active: true,
    ...over,
  };
}

describe('read receipts in a group', () => {
  const sent = message({ id: 'm1', sender_id: ME, created_at: '2026-01-02T10:00:00.000Z' });

  it('is NOT read when only one of two recipients has caught up', () => {
    const readTimes = new Map<string, Date | null>([
      [ME, AT('2026-01-02T10:00:00.000Z')],
      [ALICE, AT('2026-01-02T11:00:00.000Z')], // read it
      [BOB, null], // has not
    ]);

    // The defect: the previous implementation returned READ here, telling the
    // author two of three recipients had seen a message one of them had not.
    expect(calculateMessageStatus(sent, ME, readTimes)).toBe(MESSAGE_STATUS.DELIVERED);
    expect(readerCount(sent, readTimes)).toBe(1);
  });

  it('is read once every recipient has caught up', () => {
    const readTimes = new Map<string, Date | null>([
      [ME, AT('2026-01-02T10:00:00.000Z')],
      [ALICE, AT('2026-01-02T11:00:00.000Z')],
      [BOB, AT('2026-01-02T12:00:00.000Z')],
    ]);
    expect(calculateMessageStatus(sent, ME, readTimes)).toBe(MESSAGE_STATUS.READ);
    expect(readerCount(sent, readTimes)).toBe(2);
  });

  it('behaves identically to the old rule in a two-person thread', () => {
    const readTimes = new Map<string, Date | null>([
      [ME, AT('2026-01-02T10:00:00.000Z')],
      [ALICE, AT('2026-01-02T11:00:00.000Z')],
    ]);
    expect(calculateMessageStatus(sent, ME, readTimes)).toBe(MESSAGE_STATUS.READ);
  });

  it('never counts the author as a reader of their own message', () => {
    const readTimes = new Map<string, Date | null>([
      [ME, AT('2026-01-02T23:00:00.000Z')], // author, caught up
      [ALICE, null],
    ]);
    expect(readerCount(sent, readTimes)).toBe(0);
    expect(calculateMessageStatus(sent, ME, readTimes)).toBe(MESSAGE_STATUS.DELIVERED);
  });

  it('is delivered, not read, when the author is alone in the thread', () => {
    const readTimes = new Map<string, Date | null>([[ME, AT('2026-01-03T00:00:00.000Z')]]);
    expect(calculateMessageStatus(sent, ME, readTimes)).toBe(MESSAGE_STATUS.DELIVERED);
  });

  it('a read time strictly before the message does not count', () => {
    const readTimes = new Map<string, Date | null>([
      [ME, null],
      [ALICE, AT('2026-01-02T09:59:59.999Z')],
    ]);
    expect(readerCount(sent, readTimes)).toBe(0);
  });

  it('reading at exactly the message timestamp counts', () => {
    const readTimes = new Map<string, Date | null>([
      [ME, null],
      [ALICE, AT('2026-01-02T10:00:00.000Z')],
    ]);
    expect(readerCount(sent, readTimes)).toBe(1);
  });

  it('marks an incoming message read once I have caught up', () => {
    const incoming = message({
      id: 'm2',
      sender_id: ALICE,
      created_at: '2026-01-02T10:00:00.000Z',
    });
    const readTimes = new Map<string, Date | null>([[ME, AT('2026-01-02T10:30:00.000Z')]]);
    expect(calculateMessageStatus(incoming, ME, readTimes)).toBe(MESSAGE_STATUS.READ);
  });
});

describe('optimistic messages', () => {
  const sender = { id: ME, username: 'me', name: 'Me', avatar_url: null };

  it('carries a client id that the stored row can echo back', () => {
    const optimistic = createOptimisticMessage(CONVERSATION, ME, 'hi', sender);
    expect(clientIdOf(optimistic)).toBe(optimistic.id);
    expect(isOptimisticMessage(optimistic)).toBe(true);
  });

  it('mints distinct ids for two messages sent in the same millisecond', () => {
    // `temp-${Date.now()}` collided, and the second silently displaced the first
    // in every Map keyed by message id.
    const ids = new Set(
      Array.from({ length: 50 }, () => createOptimisticMessage(CONVERSATION, ME, 'hi', sender).id)
    );
    expect(ids.size).toBe(50);
  });

  it('still recognises a legacy temp- bubble with no client id', () => {
    const legacy = message({
      id: 'temp-1767225600000',
      sender_id: ME,
      created_at: '2026-01-01T00:00:00.000Z',
    });
    expect(isOptimisticMessage(legacy)).toBe(true);
  });

  it('a confirmed row is not optimistic even though it keeps the client id', () => {
    const confirmed = message({
      id: 'a3f1c8e0-0000-4000-8000-000000000001',
      sender_id: ME,
      created_at: '2026-01-01T00:00:00.000Z',
      metadata: { client_id: 'temp-abc' },
    });
    expect(isOptimisticMessage(confirmed)).toBe(false);
  });

  it('reports PENDING for an unconfirmed bubble', () => {
    const optimistic = createOptimisticMessage(CONVERSATION, ME, 'hi', sender);
    expect(calculateMessageStatus(optimistic, ME, new Map())).toBe(MESSAGE_STATUS.PENDING);
  });
});

describe('merging what the client has with what the server said', () => {
  it('replaces the optimistic bubble instead of rendering it twice', () => {
    const optimistic = message({
      id: 'temp-abc',
      sender_id: ME,
      created_at: '2026-01-02T10:00:00.000Z',
      metadata: { client_id: 'temp-abc' },
    });
    const confirmed = message({
      id: 'a3f1c8e0-0000-4000-8000-000000000002',
      sender_id: ME,
      created_at: '2026-01-02T10:00:00.100Z',
      metadata: { client_id: 'temp-abc' },
    });

    // This is the realtime-INSERT-wins-the-race case. Deduping on id alone —
    // which is what the previous implementation did — left both in the list.
    const merged = mergeMessages([optimistic], [confirmed]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(confirmed.id);
  });

  it('is idempotent when the same row arrives twice', () => {
    const row = message({ id: 'm1', sender_id: ALICE, created_at: '2026-01-02T10:00:00.000Z' });
    expect(mergeMessages([row], [row])).toHaveLength(1);
    expect(mergeMessages(mergeMessages([row], [row]), [row])).toHaveLength(1);
  });

  it('orders chronologically', () => {
    const a = message({ id: 'a', sender_id: ME, created_at: '2026-01-02T10:00:02.000Z' });
    const b = message({ id: 'b', sender_id: ME, created_at: '2026-01-02T10:00:01.000Z' });
    expect(mergeMessages([a], [b]).map(m => m.id)).toEqual(['b', 'a']);
  });

  it('breaks ties deterministically so equal timestamps do not jitter', () => {
    const same = '2026-01-02T10:00:00.000Z';
    const x = message({ id: 'x', sender_id: ME, created_at: same });
    const y = message({ id: 'y', sender_id: ME, created_at: same });
    expect(mergeMessages([x], [y]).map(m => m.id)).toEqual(mergeMessages([y], [x]).map(m => m.id));
  });

  it('preserves the app-level fields threadkit does not model', () => {
    const row = message({
      id: 'm1',
      sender_id: ALICE,
      created_at: '2026-01-02T10:00:00.000Z',
      sender: { id: ALICE, username: 'alice', name: 'Alice', avatar_url: null },
    });
    const [merged] = mergeMessages([], [row]);
    expect(merged.sender?.username).toBe('alice');
    expect(merged.message_type).toBe('text');
  });
});

describe('the Supabase → threadkit mapping', () => {
  it('keeps whole-history visibility, so nothing readable today becomes hidden', () => {
    // threadkit defaults visibleFrom to joinedAt. Taking that default would have
    // hidden every message sent before a participant joined — correct for a
    // clinical thread, wrong for a group chat where history is shared.
    const joinedLate = toThreadParticipant(
      participant({ user_id: BOB, joined_at: '2026-06-01T00:00:00.000Z' })
    );
    expect(joinedLate.visibleFrom).toBe('thread-start');

    const old = toThreadMessage(
      message({ id: 'm0', sender_id: ALICE, created_at: '2026-01-01T00:00:00.000Z' })
    );
    const thread = toThread(CONVERSATION, [
      participant({ user_id: ALICE }),
      participant({
        user_id: BOB,
        joined_at: '2026-06-01T00:00:00.000Z',
        last_read_at: '2026-07-01T00:00:00.000Z',
      }),
    ]);
    // Bob joined months after m0 and can still see it, so his read counts.
    expect(readersOf(thread, old).map(p => p.actorId)).toEqual([BOB]);
  });

  it('an inactive participant loses their voice, not their history', () => {
    const gone = toThreadParticipant(participant({ user_id: BOB, is_active: false }));
    expect(gone.canWrite).toBe(false);
    // No leftAt is invented: the row never recorded when they left, and guessing
    // would either hide messages they saw or reveal ones they should not.
    expect(gone.leftAt).toBeUndefined();
  });

  it('treats a missing last_read_at as never read', () => {
    expect(toThreadParticipant(participant({ user_id: ALICE })).lastReadAt).toBeNull();
  });

  it('ignores a non-string client id rather than trusting it', () => {
    const odd = message({
      id: 'm1',
      sender_id: ME,
      created_at: '2026-01-02T10:00:00.000Z',
      metadata: { client_id: 12345 },
    });
    expect(clientIdOf(odd)).toBeUndefined();
  });
});

describe('applyStatusToMessages', () => {
  it('does not claim read for a group message only one recipient has seen', () => {
    const readTimes = new Map<string, Date | null>([
      [ME, null],
      [ALICE, AT('2026-01-02T11:00:00.000Z')],
      [BOB, null],
    ]);
    const [out] = applyStatusToMessages(
      [message({ id: 'm1', sender_id: ME, created_at: '2026-01-02T10:00:00.000Z' })],
      ME,
      readTimes
    );
    expect(out.status).toBe(MESSAGE_STATUS.DELIVERED);
    expect(out.is_read).toBe(false);
  });

  it('falls back to SENT when there is no current user', () => {
    const [out] = applyStatusToMessages(
      [message({ id: 'm1', sender_id: ME, created_at: '2026-01-02T10:00:00.000Z' })],
      undefined,
      new Map()
    );
    expect(out.status).toBe(MESSAGE_STATUS.SENT);
  });
});
