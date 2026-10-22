import { createSearch } from '@bitbaum/searchkit';
import type { Conversation } from '../types';
import { getConversationDisplayName, getOtherParticipants } from './conversation-display';

/** Search only conversations already visible to this user; never fetch extra messages. */
export function createConversationSearch(conversations: Conversation[], currentUserId?: string) {
  return createSearch(conversations, {
    fields: [
      { name: 'title', get: item => getConversationDisplayName(item, currentUserId) },
      {
        name: 'people',
        get: item =>
          getOtherParticipants(item, currentUserId).flatMap(person => [
            person.name,
            person.username,
          ]),
      },
      { name: 'preview', get: item => item.last_message_preview },
    ],
    rank: item => Date.parse(item.last_message_at ?? '') || 0,
  });
}
