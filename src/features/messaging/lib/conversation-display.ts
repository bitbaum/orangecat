import type { Conversation } from '../types';

export function getOtherParticipants(conversation: Conversation, currentUserId?: string) {
  return (Array.isArray(conversation.participants) ? conversation.participants : []).filter(
    participant => participant?.is_active && participant.user_id !== currentUserId
  );
}

/** One name for the inbox, conversation header, and search index. */
export function getConversationDisplayName(
  conversation: Conversation,
  currentUserId?: string
): string {
  if (conversation.title?.trim()) {
    return conversation.title;
  }
  const others = getOtherParticipants(conversation, currentUserId);
  if (others.length === 0) {
    return 'Notes to Self';
  }
  return (
    others
      .slice(0, 3)
      .map(person => person.name || person.username || 'Unknown user')
      .join(', ') + (others.length > 3 ? ` +${others.length - 3}` : '')
  );
}
