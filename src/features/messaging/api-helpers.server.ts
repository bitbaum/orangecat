/**
 * Messaging API Helpers
 *
 * Database operations shared by the conversation-messages route.
 * Extracted to keep the route thin (HTTP layer only).
 */

import { PRIVILEGED_ROLES } from '@/services/actors/resolveCreationActor';
import { fromTable } from '@/lib/supabase/untyped';
import { createAdminClient } from '@/lib/supabase/admin';
import { noteCatMention } from '@/services/mentions/note-mention';
import { DATABASE_TABLES } from '@/config/database-tables';
import { CAT_DISPLAY_NAME, CAT_USERNAME } from '@/config/cat-identity';
import { logger } from '@/utils/logger';
import type { Database } from '@/types/database';
import {
  fetchMessages as svcFetchMessages,
  sendMessage as svcSendMessage,
} from '@/features/messaging/service.server';
import type { Message, Pagination } from './types';
import { attachmentSummary } from '@bitbaum/chatkit';
import {
  PAYMENT_REQUEST_KEY,
  REPLY_KEY,
  claimablePaymentRequest,
  replySnapshot,
  withoutServerKeys,
} from './server/extras';
import {
  attachToMessage,
  claimableAttachments,
  toAttachmentDto,
  type MessageAttachmentDto,
} from './server/attachments';

/** What a message of only files is called in the conversation list. */
const ATTACHMENT_PREVIEW_LABELS = {
  you: '',
  photo: 'Photo',
  photos: '{n} photos',
  video: 'Video',
  audio: 'Audio',
  file: 'File',
  attachments: '{n} attachments',
  empty: '',
};
// Single source of truth for the actor shape — shared with the client hook
// that consumes this endpoint (avoids the response/consumer types drifting).
import type { MessagingActor } from '@/features/messaging/hooks/useMessagingActors';

type AdminClient = ReturnType<typeof createAdminClient>;

type ParticipantRow = {
  user_id: string;
  role: string;
  joined_at: string;
  last_read_at: string | null;
  is_active: boolean;
  profiles: { username: string | null; name: string | null; avatar_url: string | null } | null;
};

export interface ConversationContext {
  conversation: Record<string, unknown>;
  formattedParticipants: Array<{
    user_id: string;
    username: string;
    name: string;
    avatar_url: string;
    role: string;
    joined_at: string;
    last_read_at: string | null;
    is_active: boolean;
  }>;
  unreadCount: number;
}

/**
 * Fetch conversation + participants + unread count for the GET response.
 * Returns null if the conversation doesn't exist.
 */
export async function fetchConversationContext(
  admin: AdminClient,
  conversationId: string,
  userId: string
): Promise<ConversationContext | null> {
  const [convResult, participantsResult] = await Promise.all([
    fromTable(admin, DATABASE_TABLES.CONVERSATIONS).select('*').eq('id', conversationId).single(),
    admin
      .from(DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
      .select(
        'user_id, role, joined_at, last_read_at, is_active, profiles:user_id (id, username, name, avatar_url)'
      )
      .eq('conversation_id', conversationId),
  ]);

  if (convResult.error || !convResult.data) {
    return null;
  }

  const formattedParticipants = ((participantsResult.data || []) as ParticipantRow[]).map(p => ({
    user_id: p.user_id,
    username: p.profiles?.username || '',
    name: p.profiles?.name || '',
    avatar_url: p.profiles?.avatar_url || '',
    role: p.role,
    joined_at: p.joined_at,
    last_read_at: p.last_read_at,
    is_active: p.is_active,
  }));

  const userParticipant = formattedParticipants.find(p => p.user_id === userId);
  let unreadCount = 0;
  if (userParticipant?.last_read_at) {
    const { count } = await admin
      .from(DATABASE_TABLES.MESSAGES)
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId)
      .gt('created_at', userParticipant.last_read_at)
      .eq('is_deleted', false);
    unreadCount = count || 0;
  }

  return {
    conversation: convResult.data as Record<string, unknown>,
    formattedParticipants,
    unreadCount,
  };
}

/**
 * Verify the user is a participant and reactivate if soft-deleted.
 * Returns 'not_found' | 'ok'.
 */
export async function verifyParticipantAndReactivate(
  admin: AdminClient,
  conversationId: string,
  userId: string
): Promise<'not_found' | 'ok'> {
  const { data, error } = await admin
    .from(DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
    .select('user_id, is_active')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return 'not_found';
  }

  const participant = data as { is_active?: boolean };
  if (participant.is_active === false) {
    const updateData: Database['public']['Tables']['conversation_participants']['Update'] = {
      is_active: true,
      last_read_at: new Date().toISOString(),
    };

    await fromTable(admin, DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
      .update(updateData)
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
  }

  return 'ok';
}

/** Success payload for the GET messages response. */
export interface ConversationMessagesPayload {
  conversation: Record<string, unknown>;
  messages: Message[];
  pagination: Pagination;
}

/**
 * Load a conversation's messages for the GET handler.
 *
 * Verifies participant access (distinguishing forbidden vs. not-found the same
 * way the route did), then fetches messages + conversation context in parallel.
 * Returns a discriminated result the route maps to an HTTP response.
 */
export async function loadConversationMessages(
  conversationId: string,
  userId: string,
  cursor: string | undefined,
  limit: number
): Promise<
  { ok: true; data: ConversationMessagesPayload } | { ok: false; code: 'forbidden' | 'not_found' }
> {
  const admin = createAdminClient();

  // Verify participant access
  const { data: participant, error: partError } = await admin
    .from(DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
    .select('user_id, last_read_at, is_active')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (partError || !participant) {
    const { data: convExists } = await admin
      .from(DATABASE_TABLES.CONVERSATIONS)
      .select('id')
      .eq('id', conversationId)
      .maybeSingle();
    return { ok: false, code: convExists ? 'forbidden' : 'not_found' };
  }

  const [{ messages, pagination }, ctx] = await Promise.all([
    svcFetchMessages(conversationId, userId, cursor, limit),
    fetchConversationContext(admin, conversationId, userId),
  ]);

  if (!ctx) {
    return { ok: false, code: 'not_found' };
  }

  return {
    ok: true,
    data: {
      conversation: {
        ...ctx.conversation,
        participants: ctx.formattedParticipants,
        unread_count: ctx.unreadCount,
      },
      messages,
      pagination,
    },
  };
}

/** Validated input for sending a message. */
export interface SendMessageInput {
  content: string;
  /** Uploads to put on the message; checked before the message is written. */
  attachmentIds?: string[];
  messageType: string;
  metadata?: Record<string, unknown>;
  /** Echoed on the stored row so the sender's bubble is not drawn twice. */
  clientId?: string;
  senderActorId?: string;
  replyToId?: string;
  paymentRequestId?: string;
}

/**
 * Send a message on behalf of `userId` for the POST handler.
 *
 * Verifies (and reactivates) participation, then delegates the insert to the
 * messaging service. Returns a discriminated result the route maps to an HTTP
 * response ('forbidden' → not a participant).
 */
export async function postConversationMessage(
  conversationId: string,
  userId: string,
  input: SendMessageInput
): Promise<
  | { ok: true; id: string; attachments: MessageAttachmentDto[] }
  | {
      ok: false;
      code:
        | 'forbidden'
        | 'attachments_invalid'
        | 'attachments_not_uploaded'
        | 'payment_request_invalid';
    }
> {
  const admin = createAdminClient();

  const membership = await verifyParticipantAndReactivate(admin, conversationId, userId);
  if (membership === 'not_found') {
    return { ok: false, code: 'forbidden' };
  }

  // Before the message exists: a message must never be written and then
  // found to be pointing at files that are not the sender's, or not there.
  const claim = await claimableAttachments(
    admin,
    userId,
    conversationId,
    input.attachmentIds ?? []
  );
  if (!claim.ok) {
    return {
      ok: false,
      code: claim.code === 'not_uploaded' ? 'attachments_not_uploaded' : 'attachments_invalid',
    };
  }
  const kinds = claim.rows.map(row => row.kind);

  // Server-owned metadata: whatever a client put under these keys is dropped,
  // and each is written only from a row this request was allowed to name.
  const metadata = withoutServerKeys(input.metadata);
  if (input.clientId) {
    metadata.client_id = input.clientId;
  }
  if (input.replyToId) {
    const quoted = await replySnapshot(admin, conversationId, input.replyToId);
    if (quoted) {
      metadata[REPLY_KEY] = quoted;
    }
  }
  let requestPreview: string | undefined;
  if (input.paymentRequestId) {
    if (!(await claimablePaymentRequest(admin, userId, conversationId, input.paymentRequestId))) {
      return { ok: false, code: 'payment_request_invalid' };
    }
    metadata[PAYMENT_REQUEST_KEY] = input.paymentRequestId;
    requestPreview = 'Payment request';
  }

  const id = await svcSendMessage(
    conversationId,
    userId,
    input.content,
    // What older readers of `message_type` expect of a message with files.
    kinds.length === 0 ? input.messageType : kinds.every(k => k === 'image') ? 'image' : 'file',
    Object.keys(metadata).length > 0 ? metadata : null,
    input.senderActorId || null,
    // The list's second line for a message without words: what it carries
    // ("Photo", "2 photos", "Payment request").
    input.content
      ? undefined
      : requestPreview || attachmentSummary(kinds, ATTACHMENT_PREVIEW_LABELS)
  );
  await attachToMessage(admin, userId, id, claim.rows);

  await noteCatMention(admin, {
    conversationId,
    messageId: id,
    senderId: userId,
    content: input.content,
  });

  return { ok: true, id, attachments: claim.rows.map(toAttachmentDto) };
}

interface ActorRow {
  id: string;
  actor_type: string;
  user_id: string | null;
  profiles: { name: string | null; avatar_url: string | null } | null;
}

// Group membership row with nested group (no actor_id on groups — actors
// table has the inverse FK via actors.group_id).
interface GroupMembershipRow {
  group_id: string;
  role: string;
  groups: {
    id: string;
    name: string | null;
    avatar_url: string | null;
  } | null;
}

// Actor row joined back from the actors table by group_id.
interface GroupActorRow {
  id: string;
  group_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * Fetch the actors a user can send messages as: their personal actor plus any
 * group actors they administer. DB errors are logged and skipped (best-effort)
 * so the endpoint always returns whatever actors it could resolve.
 */
export async function fetchMessagingActors(userId: string): Promise<MessagingActor[]> {
  const admin = createAdminClient();
  const actors: MessagingActor[] = [];

  // 1. Get user's personal actor (join profiles for name/avatar)
  const { data: personalActorData, error: personalError } = await admin
    .from(DATABASE_TABLES.ACTORS)
    .select('id, actor_type, user_id, profiles:user_id (name, avatar_url)')
    .eq('user_id', userId)
    .eq('actor_type', 'user')
    // Oldest first, take one: the same rule as lookupUserActor. maybeSingle()
    // errors for a person with duplicate actors, and the picker then offered
    // no way to write as themselves.
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (personalError) {
    logger.error(
      'Error fetching personal actor',
      { error: personalError, userId },
      'MessagingActors'
    );
  }

  const personalActor = personalActorData as ActorRow | null;
  if (personalActor) {
    actors.push({
      actor_id: personalActor.id,
      actor_type: 'user',
      name: personalActor.profiles?.name || 'You',
      avatar_url: personalActor.profiles?.avatar_url || null,
      is_personal: true,
    });
  }

  // 2. Get group actors where user is a privileged member.
  //    Schema reality: actors.group_id points at groups (not the
  //    inverse). So we (a) find the groups the user runs, then (b)
  //    fetch actor rows whose group_id matches one of them.
  const { data: groupMemberships, error: groupError } = await admin
    .from(DATABASE_TABLES.GROUP_MEMBERS)
    .select(
      `
      group_id,
      role,
      groups:group_id (
        id,
        name,
        avatar_url
      )
    `
    )
    .eq('user_id', userId)
    .in('role', [...PRIVILEGED_ROLES]);

  if (groupError) {
    logger.error(
      'Error fetching group memberships',
      { error: groupError, userId },
      'MessagingActors'
    );
  }

  const memberships = (groupMemberships || []) as GroupMembershipRow[];
  if (memberships.length > 0) {
    const groupIds = memberships.map(m => m.group_id).filter((id): id is string => !!id);

    if (groupIds.length > 0) {
      const { data: groupActorRows, error: groupActorError } = await admin
        .from(DATABASE_TABLES.ACTORS)
        .select('id, group_id, display_name, avatar_url')
        .eq('actor_type', 'group')
        .in('group_id', groupIds);

      if (groupActorError) {
        logger.error(
          'Error fetching group actors',
          { error: groupActorError, userId, groupIds },
          'MessagingActors'
        );
      }

      const groupActors = (groupActorRows || []) as GroupActorRow[];
      const groupById = new Map<string, GroupMembershipRow['groups']>();
      for (const m of memberships) {
        if (m.groups) {
          groupById.set(m.group_id, m.groups);
        }
      }

      for (const a of groupActors) {
        const linkedGroup = groupById.get(a.group_id);
        actors.push({
          actor_id: a.id,
          actor_type: 'group',
          name: a.display_name || linkedGroup?.name || 'Group',
          avatar_url: a.avatar_url || linkedGroup?.avatar_url || null,
          is_personal: false,
        });
      }
    }
  }

  return actors;
}

/** The Cat, as a member people can bring into a conversation. */
export interface MessagingAgent {
  id: string;
  username: string;
  name: string;
  avatar_url: string | null;
}

/**
 * The Cat's account, for the Messenger. `null` when it has not been
 * established yet (the daily cat-account job does that): the Messenger then
 * simply offers no agent.
 */
export async function fetchMessagingAgent(): Promise<MessagingAgent | null> {
  const { data, error } = await createAdminClient()
    .from(DATABASE_TABLES.PROFILES)
    .select('id, username, name, avatar_url')
    .eq('username', CAT_USERNAME)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return {
    id: data.id,
    username: data.username ?? CAT_USERNAME,
    name: data.name || CAT_DISPLAY_NAME,
    avatar_url: data.avatar_url ?? null,
  };
}
