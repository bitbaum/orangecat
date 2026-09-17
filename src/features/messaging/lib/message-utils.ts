/**
 * Message Utilities Module
 *
 * Shared utilities for message status calculation, formatting, and validation.
 * Single source of truth for all message-related logic to eliminate code duplication.
 *
 * @module messaging/lib/message-utils
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  mergeMessages as mergeThreadMessages,
  readersOf,
  type Participant as ThreadParticipant,
  type Thread,
} from 'threadkit';
import type { Message, Participant } from '../types';
import { MESSAGE_STATUS, type MessageStatus } from './constants';
import { CLIENT_ID_METADATA_KEY, clientIdOf, toThreadMessage } from './threadkit-adapter';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';

// =============================================================================
// MESSAGE STATUS CALCULATION
// =============================================================================

interface _ParticipantReadTime {
  userId: string;
  lastReadAt: Date | null;
}

/**
 * Calculate the delivery/read status of a message
 *
 * Status progression (like Facebook Messenger):
 * 1. pending - Message is being sent (optimistic)
 * 2. sent - Message reached server (in database)
 * 3. delivered - Message was delivered to recipient's device
 * 4. read - Recipient opened the conversation and saw the message
 *
 * Note: We don't track "delivered" separately from "sent" currently.
 * Once a message is in the database, we consider it "delivered" to the recipient.
 *
 * @param message - The message to calculate status for
 * @param currentUserId - The current user's ID
 * @param participantReadTimes - Map of participant IDs to their last_read_at times
 * @returns The calculated message status
 */
export function calculateMessageStatus(
  message: Message,
  currentUserId: string | undefined,
  participantReadTimes: Map<string, Date | null>
): MessageStatus {
  if (!currentUserId) {
    return MESSAGE_STATUS.SENT;
  }

  // Optimistic/pending messages (not yet confirmed by server)
  if (isOptimisticMessage(message)) {
    return MESSAGE_STATUS.PENDING;
  }

  // Explicitly failed messages
  if (message.status === MESSAGE_STATUS.FAILED) {
    return MESSAGE_STATUS.FAILED;
  }

  // For messages FROM the current user, "read" is decided by threadkit's
  // readersOf, which excludes the author and anyone whose visibility window
  // does not contain the message.
  //
  // It is a stricter test than the one it replaces, and deliberately so. The
  // previous implementation returned READ as soon as ANY other participant had
  // caught up. In a two-person conversation that is the same answer. In a group
  // it told you your message had been read when two of three recipients had not
  // seen it — a claim the UI made on your behalf that simply was not true.
  if (message.sender_id === currentUserId) {
    const thread = threadFromReadTimes(participantReadTimes);
    const recipients = thread.participants.filter(p => p.actorId !== currentUserId);
    if (recipients.length === 0) {
      return MESSAGE_STATUS.DELIVERED;
    }
    const seenBy = readersOf(thread, toThreadMessage(message));
    return seenBy.length === recipients.length ? MESSAGE_STATUS.READ : MESSAGE_STATUS.DELIVERED;
  }

  // For messages TO the current user - check if current user has caught up.
  const userLastReadAt = participantReadTimes.get(currentUserId);
  if (userLastReadAt && new Date(message.created_at) <= userLastReadAt) {
    return MESSAGE_STATUS.READ;
  }

  return MESSAGE_STATUS.DELIVERED;
}

/**
 * How many other participants have seen this message.
 *
 * Exposed because `MessageStatus` is a single flag and a group thread has a
 * number. A UI that wants "seen by 2 of 3" can have it without recomputing the
 * rule, and without the flag having to lie in order to say something.
 */
export function readerCount(
  message: Message,
  participantReadTimes: Map<string, Date | null>
): number {
  return readersOf(threadFromReadTimes(participantReadTimes), toThreadMessage(message)).length;
}

/**
 * A threadkit thread carrying only what a read receipt needs.
 *
 * `visibleFrom: 'thread-start'` matches OrangeCat's product rule that everyone
 * in a conversation shares its whole history — see threadkit-adapter for why
 * taking threadkit's stricter default here would retroactively hide messages.
 * `joinedAt` is unused when `visibleFrom` is set, so the epoch is honest filler
 * rather than a guess with consequences.
 */
function threadFromReadTimes(participantReadTimes: Map<string, Date | null>): Thread {
  const participants: ThreadParticipant[] = [...participantReadTimes.entries()].map(
    ([actorId, lastReadAt]) => ({
      actorId,
      kind: 'human' as const,
      joinedAt: new Date(0),
      visibleFrom: 'thread-start' as const,
      lastReadAt,
    })
  );
  return { id: '', participants, createdAt: new Date(0) };
}

/**
 * Apply read status to an array of messages
 *
 * @param messages - Array of messages to process
 * @param currentUserId - The current user's ID
 * @param participantReadTimes - Map of participant IDs to their last_read_at times
 * @returns Messages with status fields populated
 */
export function applyStatusToMessages(
  messages: Message[],
  currentUserId: string | undefined,
  participantReadTimes: Map<string, Date | null>
): Message[] {
  return messages.map(msg => {
    const status = calculateMessageStatus(msg, currentUserId, participantReadTimes);
    return {
      ...msg,
      status,
      is_read: status === MESSAGE_STATUS.READ,
      is_delivered:
        status === MESSAGE_STATUS.DELIVERED ||
        status === MESSAGE_STATUS.READ ||
        status === MESSAGE_STATUS.SENT,
    };
  });
}

/**
 * Build a participant read times map from participant array
 *
 * @param participants - Array of participants
 * @returns Map of user ID to last read time
 */
export function buildParticipantReadTimesMap(
  participants: Participant[]
): Map<string, Date | null> {
  const map = new Map<string, Date | null>();
  for (const p of participants) {
    map.set(p.user_id, p.last_read_at ? new Date(p.last_read_at) : null);
  }
  return map;
}

// =============================================================================
// MESSAGE FORMATTING
// =============================================================================

/**
 * Format a message timestamp for display (like Messenger)
 *
 * - Today: "2:30 PM"
 * - Yesterday: "Yesterday 2:30 PM"
 * - This week: "Tuesday 2:30 PM"
 * - This year: "Nov 15 at 2:30 PM"
 * - Older: "Nov 15, 2023"
 */
export function formatMessageTime(dateStr: string, options: { short?: boolean } = {}): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString(APP_LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (options.short) {
    // For compact display in message list
    if (diffDays === 0) {
      return timeStr;
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 7) {
      return date.toLocaleDateString(APP_LOCALE, { weekday: 'short' });
    }
    return date.toLocaleDateString(APP_LOCALE, { month: 'short', day: 'numeric' });
  }

  // Full display
  if (diffDays === 0) {
    return timeStr;
  }
  if (diffDays === 1) {
    return `Yesterday ${timeStr}`;
  }
  if (diffDays < 7) {
    return `${date.toLocaleDateString(APP_LOCALE, { weekday: 'long' })} ${timeStr}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    return (
      date.toLocaleDateString(APP_LOCALE, {
        month: 'short',
        day: 'numeric',
      }) + ` at ${timeStr}`
    );
  }
  return date.toLocaleDateString(APP_LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format relative time (like "5m", "2h", "3d")
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);

  if (minutes < 1) {
    return 'now';
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  if (hours < 24) {
    return `${hours}h`;
  }
  if (days < 7) {
    return `${days}d`;
  }
  if (weeks < 4) {
    return `${weeks}w`;
  }
  return date.toLocaleDateString(APP_LOCALE, { month: 'short', day: 'numeric' });
}

/**
 * Get date divider text for message grouping
 */
export function getDateDividerText(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return date.toLocaleDateString(APP_LOCALE, { weekday: 'long' });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(APP_LOCALE, { month: 'long', day: 'numeric' });
  }
  return date.toLocaleDateString(APP_LOCALE, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Check if a date divider should be shown between two messages
 */
export function shouldShowDateDivider(currentMsg: Message, prevMsg: Message | null): boolean {
  if (!prevMsg) {
    return true;
  }
  const currentDate = new Date(currentMsg.created_at).toDateString();
  const prevDate = new Date(prevMsg.created_at).toDateString();
  return currentDate !== prevDate;
}

// =============================================================================
// CONVERSATION HELPERS
// =============================================================================

/**
 * Get display name for a conversation
 * - Group: Use title or list participant names
 * - Direct: Show other participant's name
 * - Self: "Notes to Self"
 */
export function getConversationDisplayName(
  title: string | null,
  isGroup: boolean,
  participants: Participant[],
  currentUserId: string | undefined
): string {
  if (title) {
    return title;
  }

  const otherParticipants = participants.filter(p => p.is_active && p.user_id !== currentUserId);

  if (otherParticipants.length === 0) {
    return 'Notes to Self';
  }

  if (otherParticipants.length === 1) {
    return otherParticipants[0].name || otherParticipants[0].username || 'Unknown User';
  }

  // Group without title - list first few names
  const names = otherParticipants
    .slice(0, 3)
    .map(p => p.name || p.username || 'Unknown')
    .filter(Boolean)
    .join(', ');

  if (otherParticipants.length > 3) {
    return `${names} +${otherParticipants.length - 3}`;
  }

  return names;
}

/**
 * Get the primary participant for a direct message (the other person)
 */
export function getPrimaryParticipant(
  participants: Participant[],
  currentUserId: string | undefined
): Participant | undefined {
  return participants.find(p => p.is_active && p.user_id !== currentUserId);
}

/**
 * Build a profile link for a participant
 */
export function getParticipantProfileHref(participant: Participant | undefined): string | null {
  if (!participant) {
    return null;
  }
  if (participant.username?.trim()) {
    return `/profiles/${encodeURIComponent(participant.username.trim())}`;
  }
  if (participant.user_id?.trim()) {
    return `/profiles/${encodeURIComponent(participant.user_id.trim())}`;
  }
  return null;
}

// =============================================================================
// MESSAGE VALIDATION
// =============================================================================

import { VALIDATION } from './constants';
import { APP_LOCALE } from '@/utils/locale';

/**
 * Validate message content
 */
export function validateMessageContent(content: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = content.trim();

  if (trimmed.length < VALIDATION.MESSAGE_MIN_LENGTH) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (trimmed.length > VALIDATION.MESSAGE_MAX_LENGTH) {
    return {
      valid: false,
      error: `Message must be under ${VALIDATION.MESSAGE_MAX_LENGTH} characters`,
    };
  }

  return { valid: true };
}

/**
 * Truncate message preview (like conversation list)
 */
export function truncateMessagePreview(content: string, maxLength = 50): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength - 3) + '...';
}

// =============================================================================
// OPTIMISTIC MESSAGE HELPERS
// =============================================================================

/**
 * Create an optimistic message for immediate UI feedback
 */
export function createOptimisticMessage(
  conversationId: string,
  senderId: string,
  content: string,
  sender: { id: string; username: string; name: string; avatar_url: string | null }
): Message {
  // A random id, not `temp-${Date.now()}`: two messages sent inside the same
  // millisecond produced the same id, and the second silently replaced the first
  // in every Map and Set keyed by it.
  const tempId = `temp-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const now = new Date().toISOString();

  return {
    id: tempId,
    conversation_id: conversationId,
    sender_id: senderId,
    content: content.trim(),
    message_type: 'text',
    // The id travels with the write and comes back on the stored row, which is
    // what lets the confirmed message REPLACE this bubble instead of arriving
    // beside it. Without it the two rows share no identity and both render.
    metadata: { [CLIENT_ID_METADATA_KEY]: tempId },
    created_at: now,
    updated_at: now,
    is_deleted: false,
    edited_at: null,
    sender,
    is_read: false,
    is_delivered: false,
    status: MESSAGE_STATUS.PENDING,
  };
}

/**
 * Check if a message is optimistic (not yet confirmed)
 */
export function isOptimisticMessage(message: Message): boolean {
  // A bubble is unconfirmed when its id IS its client id — the stored row keeps
  // the client id but gets a real primary key. The `temp-` prefix check is kept
  // for messages already sitting in a client from before this change.
  const clientId = clientIdOf(message);
  return (clientId !== undefined && clientId === message.id) || message.id.startsWith('temp-');
}

/**
 * Merge optimistic messages with confirmed messages
 * Removes duplicates and maintains sort order
 */
export function mergeMessages(existingMessages: Message[], newMessages: Message[]): Message[] {
  // Delegates identity and ordering to threadkit, which resolves by id AND by
  // client id. The previous implementation deduped on id alone, so an optimistic
  // bubble (`temp-…`) and its stored row (a uuid) shared no identity: whenever
  // the realtime INSERT landed before the write's own response, the same message
  // rendered twice. It also gains a deterministic tiebreak, so two messages with
  // identical timestamps stop swapping places between renders.
  const byKey = new Map<string, Message>();
  for (const m of [...existingMessages, ...newMessages]) {
    byKey.set(m.id, m);
  }

  const ordered = mergeThreadMessages(
    existingMessages.map(toThreadMessage),
    newMessages.map(toThreadMessage)
  );

  return ordered.map(tm => byKey.get(tm.id)).filter((m): m is Message => m !== undefined);
}

/**
 * Replace an optimistic message with the confirmed version
 */
export function confirmOptimisticMessage(
  messages: Message[],
  tempId: string,
  confirmedMessage: Message
): Message[] {
  const withoutOptimistic = messages.filter(m => m.id !== tempId);
  if (withoutOptimistic.find(m => m.id === confirmedMessage.id)) {
    return withoutOptimistic;
  }
  return mergeMessages(withoutOptimistic, [confirmedMessage]);
}

// =============================================================================
// REALTIME FETCH HELPERS
// =============================================================================

type RawPayload = Record<string, unknown>;

type MessageWithSender = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  edited_at: string | null;
  sender: {
    id: string;
    username: string | null;
    name: string | null;
    avatar_url: string | null;
  } | null;
};

const FALLBACK_SENDER = (senderId: string) => ({
  id: senderId,
  username: '',
  name: '',
  avatar_url: null as string | null,
});

/**
 * Fetch a full Message object from the database given a realtime INSERT payload.
 *
 * Tries message_details view first (richest data), falls back to messages+profiles
 * join, and as a last resort constructs from the raw payload so the caller always
 * gets something usable.
 */
export async function fetchFullMessage(
  supabase: SupabaseClient,
  messageId: string,
  payloadNew: RawPayload
): Promise<Message | null> {
  const senderId = payloadNew.sender_id as string;

  const { data: details, error: viewError } = await supabase
    .from(DATABASE_TABLES.MESSAGE_DETAILS)
    .select('*')
    .eq('id', messageId)
    .single();

  if (details && !viewError) {
    const msg = details as Message;
    return {
      ...msg,
      sender: msg.sender ?? FALLBACK_SENDER(senderId),
      is_delivered: msg.is_delivered ?? true,
      is_read: msg.is_read ?? false,
      status: msg.status || (msg.is_read ? MESSAGE_STATUS.READ : MESSAGE_STATUS.DELIVERED),
    };
  }

  const { data: joined, error: joinError } = await supabase
    .from(DATABASE_TABLES.MESSAGES)
    .select('*, sender:profiles!messages_sender_id_fkey(id, username, name, avatar_url)')
    .eq('id', messageId)
    .single();

  const typedJoined = joined as MessageWithSender | null;

  if (typedJoined && !joinError) {
    return {
      ...typedJoined,
      sender: typedJoined.sender
        ? {
            id: typedJoined.sender.id,
            username: typedJoined.sender.username || '',
            name: typedJoined.sender.name || '',
            avatar_url: typedJoined.sender.avatar_url || null,
          }
        : FALLBACK_SENDER(senderId),
      is_read: false,
      is_delivered: true,
      status: MESSAGE_STATUS.DELIVERED,
    } as Message;
  }

  logger.error('Failed to fetch message', joinError || viewError, 'Messaging');

  if (!payloadNew.id) {
    return null;
  }

  return {
    id: payloadNew.id as string,
    conversation_id: payloadNew.conversation_id as string,
    sender_id: senderId,
    content: payloadNew.content as string,
    message_type: (payloadNew.message_type as string) || 'text',
    metadata: (payloadNew.metadata as Record<string, unknown>) || null,
    created_at: payloadNew.created_at as string,
    updated_at: (payloadNew.updated_at as string) || (payloadNew.created_at as string),
    is_deleted: (payloadNew.is_deleted as boolean) || false,
    edited_at: (payloadNew.edited_at as string) || null,
    sender: FALLBACK_SENDER(senderId),
    is_read: false,
    is_delivered: true,
    status: MESSAGE_STATUS.DELIVERED,
  } as Message;
}
