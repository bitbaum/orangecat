import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/utils/logger';
import type { Conversation, Message, Pagination, Participant } from '../types';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { isCatUsername } from '@/config/cat-identity';
import { attachmentsOfMessages } from './attachments';
import { seatPricesFor, seatsOfAccounts } from './bot-seats';
import { paymentRequestIdOf, paymentRequestsById, reactionsOfMessages, replyOf } from './extras';
import {
  assertMember,
  getServerUser,
  type ConversationParticipantsRow,
  type ConversationsRow,
  type ProfilesRow,
} from './shared';

export async function fetchUserConversations(
  userId: string,
  limit: number = 30
): Promise<Conversation[]> {
  try {
    logger.info('fetchUserConversations: Starting, limit=', limit);
    let user;
    try {
      const { user: u } = await getServerUser();
      user = u;
    } catch (authError) {
      logger.error('fetchUserConversations: Auth error:', authError);
      return [];
    }

    if (!user) {
      logger.error('fetchUserConversations: No user found');
      return [];
    }
    logger.info('fetchUserConversations: User found', user.id);

    // Use admin client to bypass RLS issues, then filter by user
    let admin;
    try {
      admin = createAdminClient();
      logger.info('fetchUserConversations: Admin client created');
    } catch (adminError) {
      logger.error('fetchUserConversations: Error creating admin client:', adminError);
      return [];
    }

    // Skip RPC function due to potential database schema issues
    // Use manual method directly
    logger.info('Using manual conversation fetching method (RPC disabled)');

    // Fallback: build conversations manually using admin client
    // Simplified query - just get conversation IDs first
    const { data: participations, error: partError } = await admin
      .from(DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
      .select('conversation_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(100); // Prevent huge queries

    if (partError) {
      logger.error('Error fetching participations:', partError);
      return [];
    }

    if (!participations || participations.length === 0) {
      return [];
    }

    const conversationIds = (participations as ConversationParticipantsRow[])
      .map(p => p.conversation_id)
      .filter(Boolean);

    if (conversationIds.length === 0) {
      return [];
    }

    // Get conversations with minimal fields first
    const { data: conversations, error: convError } = await admin
      .from(DATABASE_TABLES.CONVERSATIONS)
      .select(
        'id, title, is_group, created_at, updated_at, last_message_at, last_message_preview, last_message_sender_id, created_by'
      )
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (convError) {
      logger.error('Error fetching conversations:', convError);
      return [];
    }

    if (!conversations || conversations.length === 0) {
      return [];
    }

    // Fetch participants separately - simplified query without profile join for now
    const { data: allParticipants, error: participantsError } = await admin
      .from(DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
      .select('conversation_id, user_id, role, joined_at, last_read_at, is_active')
      .in('conversation_id', conversationIds);

    if (participantsError) {
      logger.error('Error fetching participants:', participantsError);
      // Return conversations without participants rather than failing
      return (conversations as ConversationsRow[]).map(c => ({
        ...c,
        participants: [],
        unread_count: 0,
      })) as Conversation[];
    }

    // Get user profiles separately to avoid complex joins
    const userIds = [...new Set((allParticipants || []).map(p => p.user_id).filter(Boolean))];
    // Only the four columns the participant list renders are selected.
    type ProfileSummary = Pick<ProfilesRow, 'id' | 'username' | 'name' | 'avatar_url'>;
    let profilesMap = new Map<string, ProfileSummary>();
    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from(DATABASE_TABLES.PROFILES)
        .select('id, username, name, avatar_url')
        .in('id', userIds);
      profilesMap = new Map((profiles || []).map(p => [p.id, p]));
    }
    // A bot's seat is an account like any other; this is what says it is one.
    const seats = await seatsOfAccounts(admin, userIds);
    const prices = await seatPricesFor(admin, user.id, seats);

    // Group participants by conversation
    const participantsByConv = new Map<string, Participant[]>();
    for (const p of (allParticipants || []) as ConversationParticipantsRow[]) {
      if (!p || !p.conversation_id) {
        continue;
      }
      const profile = profilesMap.get(p.user_id);
      const list = participantsByConv.get(p.conversation_id) || [];
      list.push({
        user_id: p.user_id,
        username: profile?.username || '',
        name: profile?.name || '',
        avatar_url: profile?.avatar_url || null,
        role: p.role,
        joined_at: p.joined_at,
        last_read_at: p.last_read_at || '',
        is_active: p.is_active,
        is_agent: isCatUsername(profile?.username) || seats.has(p.user_id),
        ...(prices.has(p.user_id) ? { agent_price_btc: prices.get(p.user_id) } : {}),
      });
      participantsByConv.set(p.conversation_id, list);
    }

    const unreadByConv = await countUnread(
      admin,
      user.id,
      conversations as ConversationsRow[],
      (allParticipants || []) as ConversationParticipantsRow[]
    );

    // Build full conversation objects with all required fields
    return (conversations as ConversationsRow[]).map(c => ({
      ...c,
      participants: participantsByConv.get(c.id) || [],
      unread_count: unreadByConv.get(c.id) ?? 0,
      last_message_preview: c.last_message_preview || null,
      last_message_sender_id: c.last_message_sender_id || null,
      last_message_at: c.last_message_at || null,
    })) as Conversation[];
  } catch (error) {
    logger.error('Error in fetchUserConversations:', error);
    // Return empty array on any error to prevent breaking the UI
    return [];
  }
}

export async function fetchConversationSummary(conversationId: string): Promise<Conversation> {
  const { user } = await getServerUser();
  if (!user) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }

  const admin = createAdminClient();
  await assertMember(admin, conversationId, user.id);

  const { data: conv } = await admin
    .from(DATABASE_TABLES.CONVERSATIONS)
    .select('*')
    .eq('id', conversationId)
    .single();
  if (!conv) {
    throw Object.assign(new Error('Conversation not found'), { status: 404 });
  }

  const { data: participants } = await admin
    .from(DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
    .select(
      `
      user_id,
      role,
      joined_at,
      last_read_at,
      is_active,
      profiles:user_id (
        id,
        username,
        name,
        avatar_url
      )
    `
    )
    .eq('conversation_id', conversationId);

  const seats = await seatsOfAccounts(
    admin,
    (participants || []).map(p => p.user_id)
  );
  const prices = await seatPricesFor(admin, user.id, seats);
  const formattedParticipants = (participants || []).map(p => ({
    user_id: p.user_id,
    username: p.profiles?.username || '',
    name: p.profiles?.name || '',
    avatar_url: p.profiles?.avatar_url || null,
    role: p.role,
    joined_at: p.joined_at,
    last_read_at: p.last_read_at,
    is_active: p.is_active,
    is_agent: isCatUsername(p.profiles?.username) || seats.has(p.user_id),
    ...(prices.has(p.user_id) ? { agent_price_btc: prices.get(p.user_id) } : {}),
  }));

  return {
    ...(conv as ConversationsRow),
    participants: formattedParticipants,
    unread_count: 0,
  } as Conversation;
}

export async function fetchMessages(
  conversationId: string,
  userId?: string,
  cursor?: string,
  limit = 50
): Promise<{ messages: Message[]; pagination: Pagination }> {
  const { user } = await getServerUser();
  if (!user) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }

  const admin = createAdminClient();
  await assertMember(admin, conversationId, user.id);

  // Fetch messages with sender info using admin client
  let query = admin
    .from(DATABASE_TABLES.MESSAGES)
    .select(
      `
      id,
      conversation_id,
      sender_id,
      content,
      message_type,
      metadata,
      created_at,
      updated_at,
      is_deleted,
      edited_at,
      profiles:sender_id (id, username, name, avatar_url)
    `,
      { count: 'exact' }
    )
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, count, error } = await query;
  if (error) {
    throw Object.assign(new Error('Failed to fetch messages'), { status: 500 });
  }

  // Get all participants' last_read_at for read receipt calculation
  const { data: allParticipants } = await admin
    .from(DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
    .select('user_id, last_read_at')
    .eq('conversation_id', conversationId)
    .eq('is_active', true);

  // Create map of user_id -> last_read_at for quick lookup
  const participantReadTimes = new Map<string, Date | null>();
  allParticipants?.forEach(p => {
    participantReadTimes.set(p.user_id, p.last_read_at ? new Date(p.last_read_at) : null);
  });

  const userLastReadAt = participantReadTimes.get(user.id) || null;
  const messageIds = (data || []).map(m => m.id);
  const metadataOf = (m: { metadata: unknown }) =>
    (m.metadata ?? null) as Record<string, unknown> | null;
  const [seats, attachments, reactions, paymentRequests] = await Promise.all([
    seatsOfAccounts(
      admin,
      (data || []).map(m => m.sender_id)
    ),
    attachmentsOfMessages(admin, messageIds),
    reactionsOfMessages(admin, messageIds),
    paymentRequestsById(
      admin,
      (data || []).map(m => paymentRequestIdOf(metadataOf(m))).filter((id): id is string => !!id)
    ),
  ]);

  // Transform to expected format
  const messages = (data || []).map(m => {
    const messageCreatedAt = new Date(m.created_at);

    // For messages sent by current user: calculate read receipt status
    // For messages from others: calculate if current user has read them
    let isRead = false;
    let isDelivered = false;
    let status: 'pending' | 'failed' | 'sent' | 'delivered' | 'read' = STATUS.MESSAGES.SENT;

    if (m.sender_id === user.id) {
      // This is the sender's own message - check if recipient(s) have read it
      // Message is delivered if it exists in DB (which it does, since we fetched it)
      isDelivered = true;
      status = STATUS.MESSAGES.DELIVERED;

      // Check if any recipient has read it (for direct messages, check the other participant)
      // For group messages, we'd check all participants, but for now just check if any participant read it
      let recipientHasRead = false;
      for (const [participantId, lastReadAt] of participantReadTimes.entries()) {
        if (participantId !== user.id && lastReadAt) {
          if (messageCreatedAt <= lastReadAt) {
            recipientHasRead = true;
            break;
          }
        }
      }

      isRead = recipientHasRead;
      if (isRead) {
        status = STATUS.MESSAGES.READ;
      }
    } else {
      // This is a message from someone else - check if current user has read it
      isDelivered = true; // If it's in the DB, it's delivered
      isRead = userLastReadAt ? messageCreatedAt <= userLastReadAt : false;
      status = isRead ? STATUS.MESSAGES.READ : STATUS.MESSAGES.DELIVERED;
    }

    return {
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      content: m.content,
      message_type: m.message_type,
      metadata: m.metadata,
      created_at: m.created_at,
      updated_at: m.updated_at,
      is_deleted: m.is_deleted,
      edited_at: m.edited_at,
      sender: {
        id: m.profiles?.id || m.sender_id,
        username: m.profiles?.username || '',
        name: m.profiles?.name || '',
        avatar_url: m.profiles?.avatar_url || null,
        // An agent's message is never drawn as a person's: the Cat by its
        // reserved handle (config/usernames.ts), a bot by its seat.
        is_agent: isCatUsername(m.profiles?.username) || seats.has(m.sender_id),
      },
      attachments: attachments.get(m.id) ?? [],
      reply_to: replyOf(metadataOf(m)),
      reactions: reactions.get(m.id) ?? [],
      payment_request: paymentRequests.get(paymentRequestIdOf(metadataOf(m)) ?? '') ?? null,
      is_read: isRead,
      is_delivered: isDelivered,
      status: status,
    };
  });

  const hasMore = messages.length > limit;
  const slice = hasMore ? messages.slice(0, limit) : messages;
  const sorted = slice.reverse() as Message[];
  const nextCursor = hasMore && sorted.length > 0 ? sorted[0].created_at : null;
  return { messages: sorted, pagination: { hasMore, nextCursor, count: count || sorted.length } };
}

/**
 * Unread messages per conversation, for the list: what somebody else wrote
 * after the viewer's read mark.
 *
 * One query for all of them, and only for conversations whose newest message
 * is newer than the mark — a list of thirty conversations that are all read
 * costs nothing. The count is capped by the rows fetched, which is enough for
 * a badge ("99+").
 */
const UNREAD_SCAN_LIMIT = 1000;

async function countUnread(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  conversations: ConversationsRow[],
  participants: ConversationParticipantsRow[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const marks = new Map<string, string>();
  for (const p of participants) {
    if (p.user_id === userId && p.conversation_id) {
      marks.set(p.conversation_id, p.last_read_at || '');
    }
  }
  const behind = conversations.filter(c => {
    const mark = marks.get(c.id);
    return (
      c.last_message_at &&
      c.last_message_sender_id !== userId &&
      (!mark || new Date(c.last_message_at) > new Date(mark))
    );
  });
  if (behind.length === 0) {
    return counts;
  }
  const oldestMark = behind
    .map(c => marks.get(c.id) || '')
    .reduce((oldest, mark) => (mark < oldest ? mark : oldest));
  let query = admin
    .from(DATABASE_TABLES.MESSAGES)
    .select('conversation_id, created_at')
    .in(
      'conversation_id',
      behind.map(c => c.id)
    )
    .neq('sender_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(UNREAD_SCAN_LIMIT);
  if (oldestMark) {
    query = query.gt('created_at', oldestMark);
  }
  const { data, error } = await query;
  if (error) {
    logger.warn('Could not count unread messages', { error: error.message });
    return counts;
  }
  for (const row of data ?? []) {
    const mark = marks.get(row.conversation_id);
    if (!mark || new Date(row.created_at) > new Date(mark)) {
      counts.set(row.conversation_id, (counts.get(row.conversation_id) ?? 0) + 1);
    }
  }
  return counts;
}
