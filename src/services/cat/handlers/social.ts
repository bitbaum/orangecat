/**
 * Demand-side + social action handlers — Cat participating in the economy,
 * not just supplying it: follow, react, comment, manage bookings, and
 * inbox hygiene. Every handler goes through the user-scoped client (RLS),
 * resolves people by @username (what the model sees in context/search),
 * and reports exactly what happened.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_REGISTRY, isValidEntityType, type EntityType } from '@/config/entity-registry';
import { NotificationService } from '@/lib/services/notifications';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { ActionHandler } from './types';

/** Resolve "@alice" / "alice" to a profile id + display bits. */
async function resolveProfileByUsername(
  supabase: AnySupabaseClient,
  raw: string
): Promise<{ id: string; username: string; name: string | null } | null> {
  const username = raw.trim().replace(/^@/, '');
  if (!username) {
    return null;
  }
  const { data } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('id, username, name')
    .eq('username', username)
    .maybeSingle();
  return (data as { id: string; username: string; name: string | null } | null) ?? null;
}

export const socialHandlers: Record<string, ActionHandler> = {
  follow_user: async (supabase, userId, _actorId, params) => {
    const target = await resolveProfileByUsername(supabase, String(params.username ?? ''));
    if (!target) {
      return {
        success: false,
        error: `No user found with username "${String(params.username ?? '')}".`,
      };
    }
    if (target.id === userId) {
      return { success: false, error: 'Cannot follow yourself.' };
    }
    const { data: existing } = await supabase
      .from(DATABASE_TABLES.FOLLOWS)
      .select('id')
      .eq('follower_id', userId)
      .eq('following_id', target.id)
      .maybeSingle();
    if (existing) {
      return { success: false, error: `Already following @${target.username}.` };
    }
    const { error } = await supabase
      .from(DATABASE_TABLES.FOLLOWS)
      .insert({ follower_id: userId, following_id: target.id });
    if (error) {
      return { success: false, error: error.message };
    }
    // Same courtesy notification the follow API sends (non-fatal).
    try {
      const { data: me } = await supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('name, username')
        .eq('id', userId)
        .maybeSingle();
      const followerName = me?.name || me?.username || 'Someone';
      // Lazy import: the dispatcher pulls the email stack (resend/postal-mime),
      // which must stay out of this module graph (jest + bundle weight).
      const { NotificationDispatcher } = await import('@/services/notifications/dispatcher');
      await NotificationDispatcher.dispatch({
        userId: target.id,
        type: 'follow',
        title: `${followerName} followed you`,
        message: `${followerName} started following you on OrangeCat.`,
        sourceEntityType: 'profile',
        sourceEntityId: userId,
        actionUrl: me?.username ? `/profiles/${me.username}` : undefined,
      });
    } catch (err) {
      logger.warn('follow notification failed', { err }, 'CatSocial');
    }
    return {
      success: true,
      data: { displayMessage: `➕ Now following @${target.username}` },
    };
  },

  unfollow_user: async (supabase, userId, _actorId, params) => {
    const target = await resolveProfileByUsername(supabase, String(params.username ?? ''));
    if (!target) {
      return {
        success: false,
        error: `No user found with username "${String(params.username ?? '')}".`,
      };
    }
    const { data: existing } = await supabase
      .from(DATABASE_TABLES.FOLLOWS)
      .select('id')
      .eq('follower_id', userId)
      .eq('following_id', target.id)
      .maybeSingle();
    if (!existing) {
      return { success: false, error: `Not following @${target.username} — nothing to change.` };
    }
    const { error } = await supabase
      .from(DATABASE_TABLES.FOLLOWS)
      .delete()
      .eq('follower_id', userId)
      .eq('following_id', target.id);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: { displayMessage: `➖ Unfollowed @${target.username}` } };
  },

  like_post: async (supabase, userId, _actorId, params) => {
    const eventId = typeof params.post_id === 'string' ? params.post_id : '';
    if (!eventId) {
      return { success: false, error: 'Pass post_id (the timeline post to like).' };
    }
    const { data: existing } = await supabase
      .from(DATABASE_TABLES.TIMELINE_LIKES)
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) {
      return { success: false, error: 'Already liked that post.' };
    }
    const { error } = await supabase
      .from(DATABASE_TABLES.TIMELINE_LIKES)
      .insert({ event_id: eventId, user_id: userId });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: { displayMessage: '👍 Liked the post' } };
  },

  comment_on_post: async (supabase, userId, _actorId, params) => {
    const eventId = typeof params.post_id === 'string' ? params.post_id : '';
    const content = typeof params.content === 'string' ? params.content.trim() : '';
    if (!eventId || !content) {
      return { success: false, error: 'Pass post_id and content (the comment text).' };
    }
    const { error } = await supabase
      .from(DATABASE_TABLES.TIMELINE_COMMENTS)
      .insert({ event_id: eventId, user_id: userId, content: content.slice(0, 5000) });
    if (error) {
      return { success: false, error: error.message };
    }
    return {
      success: true,
      data: { displayMessage: `💬 Comment posted: "${content.slice(0, 60)}"` },
    };
  },

  mark_notifications_read: async (supabase, userId) => {
    const service = new NotificationService(supabase as never);
    const before = await service.getUnreadCount(userId);
    if (before === 0) {
      return { success: true, data: { displayMessage: 'Inbox already clear — nothing unread.' } };
    }
    const ok = await service.markAllAsRead(userId);
    if (!ok) {
      return { success: false, error: 'Could not mark notifications read.' };
    }
    return {
      success: true,
      data: { displayMessage: `📭 Marked ${before} notification${before === 1 ? '' : 's'} read` },
    };
  },

  // The connection step of discovery: open a real conversation with the person
  // behind an entity and send the user's intro. Requires confirmation — this
  // messages a stranger on the user's behalf, and messaging here has no block
  // list, so the confirmation IS the consent gate.
  request_introduction: async (supabase, userId, _actorId, params) => {
    const entityType = typeof params.entity_type === 'string' ? params.entity_type : '';
    const entityId = typeof params.entity_id === 'string' ? params.entity_id : '';
    const message = typeof params.message === 'string' ? params.message.trim() : '';
    if (!isValidEntityType(entityType) || !entityId) {
      return {
        success: false,
        error:
          'Pass entity_type and entity_id of the thing you want an introduction about (from explore_topic results).',
      };
    }
    if (message.length < 10) {
      return {
        success: false,
        error:
          'Pass a "message" — the intro to send in the user\'s voice, saying who they are and why they are reaching out.',
      };
    }

    const meta = ENTITY_REGISTRY[entityType as EntityType];
    const titleCol = meta.titleColumn ?? 'title';
    const { data: entity, error: entityError } = await supabase
      .from(meta.tableName)
      .select(`id, ${titleCol}, actor_id, user_id`)
      .eq('id', entityId)
      .maybeSingle();
    if (entityError || !entity) {
      return { success: false, error: `No ${meta.name.toLowerCase()} found with that id.` };
    }
    // The selected columns are built from the registry at runtime, so the
    // typed-select parser can't narrow them — go through unknown.
    const rec = entity as unknown as Record<string, unknown>;

    // Resolve the owner the same way discovery does: actor → profile.
    let ownerUserId = typeof rec.user_id === 'string' ? rec.user_id : null;
    if (!ownerUserId && typeof rec.actor_id === 'string') {
      const { data: actor } = await supabase
        .from(DATABASE_TABLES.ACTORS)
        .select('user_id')
        .eq('id', rec.actor_id)
        .maybeSingle();
      ownerUserId = (actor as { user_id: string | null } | null)?.user_id ?? null;
    }
    if (!ownerUserId) {
      return {
        success: false,
        error: 'Could not work out who owns that — no introduction was sent.',
      };
    }
    if (ownerUserId === userId) {
      return { success: false, error: "That's the user's own listing — no introduction needed." };
    }

    const { data: ownerProfile } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('username, name')
      .eq('id', ownerUserId)
      .maybeSingle();
    const owner = ownerProfile as { username: string | null; name: string | null } | null;
    const ownerLabel = owner?.name || (owner?.username ? `@${owner.username}` : 'them');

    // Lazy import: messaging helpers pull the notification/email stack.
    const { openOrCreateConversation } = await import(
      '@/features/messaging/lib/conversation-helpers'
    );
    const convo = await openOrCreateConversation(userId, [ownerUserId]);
    const conversationId =
      (convo as { conversationId?: string; id?: string }).conversationId ??
      (convo as { id?: string }).id;
    if (!conversationId) {
      return { success: false, error: 'Could not open a conversation — nothing was sent.' };
    }

    const title = String(rec[titleCol] ?? meta.name);
    const body = `${message}\n\n— sent via OrangeCat about "${title}"`;
    const { error: sendError } = await supabase.from(DATABASE_TABLES.MESSAGES).insert({
      conversation_id: conversationId,
      sender_id: userId,
      content: body,
      message_type: 'text',
    });
    if (sendError) {
      return { success: false, error: `Could not send the message: ${sendError.message}` };
    }

    return {
      success: true,
      data: {
        conversationId,
        displayMessage: `🤝 Introduction sent to ${ownerLabel} about "${title}"`,
      },
    };
  },

  book_service: async (supabase, userId, _actorId, params) => {
    const bookableId = typeof params.service_id === 'string' ? params.service_id : '';
    const startsAt = typeof params.starts_at === 'string' ? params.starts_at : '';
    if (!bookableId || !startsAt) {
      return {
        success: false,
        error: 'Pass service_id (from context or search) and starts_at (ISO date-time).',
      };
    }
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) {
      return { success: false, error: `Invalid starts_at "${startsAt}" — use ISO date-time.` };
    }
    const endsAt =
      typeof params.ends_at === 'string' && !Number.isNaN(new Date(params.ends_at).getTime())
        ? params.ends_at
        : new Date(start.getTime() + 60 * 60 * 1000).toISOString();

    // Lazy: the booking service transitively imports the email stack.
    const { createBookingService } = await import('@/services/bookings');
    const bookings = createBookingService(supabase);
    const result = await bookings.createBooking(
      {
        bookable_type: 'service',
        bookable_id: bookableId,
        starts_at: start.toISOString(),
        ends_at: endsAt,
        customer_notes: typeof params.notes === 'string' ? params.notes : undefined,
      },
      userId
    );
    if (!result.success) {
      return { success: false, error: result.error ?? 'Booking failed.' };
    }
    return {
      success: true,
      data: {
        ...(result.booking ?? {}),
        displayMessage: `📅 Booking requested for ${start.toISOString()} — the provider must confirm it.`,
      },
    };
  },

  accept_booking: async (supabase, _userId, actorId, params) => {
    const bookingId = typeof params.booking_id === 'string' ? params.booking_id : '';
    if (!bookingId) {
      return { success: false, error: 'Pass booking_id (shown in your bookings context).' };
    }
    const { createBookingService } = await import('@/services/bookings');
    const bookings = createBookingService(supabase);
    const result = await bookings.confirmBooking(bookingId, actorId);
    if (!result.success) {
      return { success: false, error: result.error ?? 'Could not confirm the booking.' };
    }
    return { success: true, data: { displayMessage: '✅ Booking confirmed' } };
  },

  decline_booking: async (supabase, _userId, actorId, params) => {
    const bookingId = typeof params.booking_id === 'string' ? params.booking_id : '';
    if (!bookingId) {
      return { success: false, error: 'Pass booking_id (shown in your bookings context).' };
    }
    const { createBookingService } = await import('@/services/bookings');
    const bookings = createBookingService(supabase);
    const result = await bookings.rejectBooking(
      bookingId,
      actorId,
      typeof params.reason === 'string' ? params.reason : undefined
    );
    if (!result.success) {
      return { success: false, error: result.error ?? 'Could not decline the booking.' };
    }
    return { success: true, data: { displayMessage: '🚫 Booking declined' } };
  },
};
