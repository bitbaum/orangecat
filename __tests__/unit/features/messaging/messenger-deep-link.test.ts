/**
 * Opening /messages?id=… for a conversation older than the newest 30 the list
 * returns: the Messenger fetches that one conversation once the list is ready
 * (transport.conversation) and adds it. On production the old screen once left
 * the inbox holding only the linked conversation (#1682). The rule, now on the
 * package's reducer: neither arrival wipes out the other.
 */
import {
  initialMessengerState,
  messengerReducer,
  reviveConversation,
  type MessengerState,
} from '@bitbaum/chatkit';
import { toMessengerConversation } from '@/features/messaging/lib/messenger-mapping';
import type { Conversation } from '@/features/messaging/types';

const conversation = (id: string, at: string | null): Conversation => ({
  id,
  title: id,
  is_group: false,
  last_message_at: at,
  last_message_preview: null,
  participants: [],
  unread_count: 0,
});

const revived = (c: Conversation) => reviveConversation(toMessengerConversation(c));
const mara = conversation('mara', '2026-11-12T10:00:00Z');
const crew = conversation('crew', '2026-11-12T09:00:00Z');
const old = conversation('old', '2026-01-01T09:00:00Z');

const ids = (state: MessengerState) => state.conversations.map(c => c.id).sort();

describe('a link to a conversation the list does not hold', () => {
  it('adds that conversation and keeps the inbox', () => {
    let state = initialMessengerState('me');
    state = messengerReducer(state, {
      type: 'list-loaded',
      conversations: [mara, crew].map(revived),
    });
    state = messengerReducer(state, { type: 'conversation', conversation: revived(old) });
    expect(ids(state)).toEqual(['crew', 'mara', 'old']);
  });

  it('does not duplicate a conversation the list already holds', () => {
    let state = initialMessengerState('me');
    state = messengerReducer(state, {
      type: 'list-loaded',
      conversations: [mara, crew].map(revived),
    });
    state = messengerReducer(state, { type: 'conversation', conversation: revived(mara) });
    expect(ids(state)).toEqual(['crew', 'mara']);
  });
});
