import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import type {
  ConversationSummary,
  SaleRecord,
  BookingRecord,
  InboundActivity,
  GroupMembershipSummary,
  SocialGraphSummary,
} from './document-context-types';

export async function fetchConversationsForCat(
  supabase: AnySupabaseClient,
  userId: string
): Promise<ConversationSummary[]> {
  try {
    const { data: participations, error: partError } = await supabase
      .from(DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
      .select('conversation_id, last_read_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(50);

    if (partError || !participations || participations.length === 0) {
      return [];
    }

    const myLastReadByConv: Record<string, string | null> = {};
    (participations as { conversation_id: string; last_read_at: string | null }[]).forEach(p => {
      myLastReadByConv[p.conversation_id] = p.last_read_at;
    });

    const convIds = participations.map((p: { conversation_id: string }) => p.conversation_id);

    const { data: conversations, error: convError } = await supabase
      .from(DATABASE_TABLES.CONVERSATIONS)
      .select('id, last_message_preview, last_message_sender_id, last_message_at, is_group')
      .in('id', convIds)
      .not('last_message_at', 'is', null)
      .order('last_message_at', { ascending: false })
      .limit(8);

    if (convError || !conversations || conversations.length === 0) {
      return [];
    }

    const recentIds = conversations.map((c: { id: string }) => c.id);

    const { data: otherParts, error: otherError } = await supabase
      .from(DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
      .select('conversation_id, user_id')
      .in('conversation_id', recentIds)
      .neq('user_id', userId)
      .eq('is_active', true);

    if (otherError) {
      logger.warn(
        'Failed to fetch conversation participants for cat',
        { error: otherError.message },
        'DocumentContext'
      );
    }

    const otherUserIds = [
      ...new Set((otherParts || []).map((p: { user_id: string }) => p.user_id)),
    ];
    const profileMap: Record<string, { username: string | null; name: string | null }> = {};

    if (otherUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('id, username, name')
        .in('id', otherUserIds);

      (profiles || []).forEach(
        (p: { id: string; username: string | null; name: string | null }) => {
          profileMap[p.id] = { username: p.username, name: p.name };
        }
      );
    }

    const otherUserByConv: Record<string, string> = {};
    (otherParts || []).forEach((p: { conversation_id: string; user_id: string }) => {
      if (!otherUserByConv[p.conversation_id]) {
        otherUserByConv[p.conversation_id] = p.user_id;
      }
    });

    return conversations.map(
      (c: {
        id: string;
        last_message_preview: string | null;
        last_message_sender_id: string | null;
        last_message_at: string | null;
        is_group: boolean;
      }) => {
        const otherUserId = otherUserByConv[c.id] ?? null;
        const profile = otherUserId ? profileMap[otherUserId] : null;
        const isMine = c.last_message_sender_id === userId;
        const lastReadAt = myLastReadByConv[c.id] ?? null;
        const hasUnread =
          !isMine &&
          c.last_message_at !== null &&
          (lastReadAt === null || new Date(c.last_message_at) > new Date(lastReadAt));
        return {
          id: c.id,
          other_username: profile?.username ?? null,
          other_name: profile?.name ?? null,
          last_message_preview: c.last_message_preview,
          last_message_is_mine: isMine,
          last_message_at: c.last_message_at,
          has_unread: hasUnread,
        };
      }
    );
  } catch (error) {
    logger.error('Exception fetching conversations for cat', error, 'DocumentContext');
    return [];
  }
}

export async function fetchInboundActivityForCat(
  supabase: AnySupabaseClient,
  userId: string
): Promise<InboundActivity> {
  try {
    const { data: actorRows } = await supabase
      .from(DATABASE_TABLES.ACTORS)
      .select('id')
      .eq('user_id', userId);
    const actorIds = (actorRows ?? []).map((a: { id: string }) => a.id);

    const now = new Date().toISOString();

    const [salesResult, bookingsResult] = await Promise.all([
      supabase
        .from(DATABASE_TABLES.ORDERS)
        .select('entity_title, entity_type, amount_btc, status, created_at')
        .eq('seller_id', userId)
        .eq('status', STATUS.ORDERS.PAID)
        .order('created_at', { ascending: false })
        .limit(10),

      actorIds.length > 0
        ? supabase
            .from(DATABASE_TABLES.BOOKINGS)
            .select(
              `
              id,
              starts_at,
              ends_at,
              status,
              customer:customer_actor_id(
                display_name,
                slug
              )
            `
            )
            .in('provider_actor_id', actorIds)
            .in('status', [STATUS.BOOKINGS.CONFIRMED, STATUS.BOOKINGS.PENDING])
            .gte('starts_at', now)
            .order('starts_at', { ascending: true })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const recentSales: SaleRecord[] = (salesResult.data ?? []).map(
      (o: {
        entity_title: string;
        entity_type: string;
        amount_btc: number;
        status: string;
        created_at: string;
      }) => ({
        entity_title: o.entity_title,
        entity_type: o.entity_type,
        amount_btc: o.amount_btc,
        status: o.status,
        created_at: o.created_at,
      })
    );

    const upcomingBookings: BookingRecord[] = (bookingsResult.data ?? []).map(
      (b: {
        id: string;
        starts_at: string;
        ends_at: string | null;
        status: string;
        // Supabase returns one-to-one FK joins as arrays; take first element.
        // The actor's handle is `slug` — the actors table has no `username`
        // column (that lives on profiles), which used to make this whole
        // sub-query error out on every Cat context build.
        customer: { display_name: string | null; slug: string | null }[] | null;
      }) => {
        const customer = Array.isArray(b.customer) ? b.customer[0] : b.customer;
        return {
          id: b.id,
          starts_at: b.starts_at,
          ends_at: b.ends_at,
          status: b.status,
          customer_display_name: customer?.display_name ?? null,
          customer_username: customer?.slug ?? null,
        };
      }
    );

    if (salesResult.error) {
      logger.warn(
        'Failed to fetch sales for cat',
        { error: salesResult.error.message },
        'DocumentContext'
      );
    }
    if (bookingsResult.error) {
      logger.warn(
        'Failed to fetch bookings for cat',
        { error: bookingsResult.error.message },
        'DocumentContext'
      );
    }

    return { recentSales, upcomingBookings };
  } catch (error) {
    logger.error('Exception fetching inbound activity for cat', error, 'DocumentContext');
    return { recentSales: [], upcomingBookings: [] };
  }
}

/**
 * The user's follow graph: follower/following counts + a few accounts they
 * follow. Gives Cat a sense of the user's network so it can reason about who
 * they're connected to (e.g. "message someone you follow").
 */
export async function fetchSocialGraphForCat(
  supabase: AnySupabaseClient,
  userId: string
): Promise<SocialGraphSummary> {
  const empty: SocialGraphSummary = { followers: 0, following: 0, recentFollowing: [] };
  try {
    const [followersRes, followingRes, recentRes] = await Promise.all([
      supabase
        .from(DATABASE_TABLES.FOLLOWS)
        .select('id', { count: 'exact', head: true })
        .eq('following_id', userId),
      supabase
        .from(DATABASE_TABLES.FOLLOWS)
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId),
      supabase
        .from(DATABASE_TABLES.FOLLOWS)
        .select('following:profiles!follows_following_id_fkey(username, name)')
        .eq('follower_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    // PostgREST types the to-one FK embed as an array; at runtime it's a single
    // object (or null). Cast through unknown per the project's PostgREST gotcha.
    const recentFollowing = (
      (recentRes.data as unknown as {
        following: { username: string | null; name: string | null } | null;
      }[]) || []
    )
      .map(r => r.following)
      .filter((p): p is { username: string | null; name: string | null } => !!p)
      .map(p => ({ username: p.username, name: p.name }));

    return {
      followers: followersRes.count ?? 0,
      following: followingRes.count ?? 0,
      recentFollowing,
    };
  } catch (error) {
    logger.error('Exception fetching social graph for cat', error, 'DocumentContext');
    return empty;
  }
}

export async function fetchGroupMembershipsForCat(
  supabase: AnySupabaseClient,
  userId: string
): Promise<GroupMembershipSummary[]> {
  try {
    const { data: memberships, error: memberError } = await supabase
      .from(DATABASE_TABLES.GROUP_MEMBERS)
      .select('group_id, role')
      .eq('user_id', userId)
      .limit(30);

    if (memberError || !memberships || memberships.length === 0) {
      if (memberError) {
        logger.warn(
          'Failed to fetch group memberships for cat',
          { error: memberError.message },
          'DocumentContext'
        );
      }
      return [];
    }

    const groupIds = memberships.map((m: { group_id: string }) => m.group_id);

    const { data: groups, error: groupsError } = await supabase
      .from(DATABASE_TABLES.GROUPS)
      .select('id, name, description, label, visibility')
      .in('id', groupIds);

    if (groupsError || !groups) {
      logger.warn(
        'Failed to fetch groups for cat membership',
        { error: groupsError?.message },
        'DocumentContext'
      );
      return [];
    }

    const roleMap = new Map(
      (memberships as { group_id: string; role: 'founder' | 'admin' | 'member' }[]).map(m => [
        m.group_id,
        m.role,
      ])
    );

    return (
      groups as {
        id: string;
        name: string;
        description: string | null;
        label: string;
        visibility: 'public' | 'members_only' | 'private';
      }[]
    ).map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      label: g.label,
      role: roleMap.get(g.id) ?? 'member',
      visibility: g.visibility,
    }));
  } catch (error) {
    logger.error('Exception fetching group memberships for cat', error, 'DocumentContext');
    return [];
  }
}
