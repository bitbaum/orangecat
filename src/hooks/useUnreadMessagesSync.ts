'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase/browser';
import { useAuth } from '@/hooks/useAuth';
import { messagingActions } from '@/stores/messaging';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { DATABASE_TABLES } from '@/config/database-tables';

/**
 * Fired after this tab marks a conversation read, so the badges drop at once
 * instead of waiting on a realtime event a self-hosted socket can miss.
 */
export const MESSAGES_READ_EVENT = 'orangecat:messages-read';

export function announceMessagesRead(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(MESSAGES_READ_EVENT));
  }
}

/**
 * Feeds the messaging store's unread count — the one number the header, the
 * sidebar and the phone tab bar all read through `useUnreadCount()`. Nothing
 * wrote it before, so every Messages badge sat at zero whatever was waiting.
 * Mount once, in the app shell.
 */
export function useUnreadMessagesSync(): void {
  const { user } = useAuth();
  // The id, not the user object: an auth refresh hands out a new object with
  // the same id, and that must not tear the channel down.
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      messagingActions.setUnreadCount(0);
      return;
    }

    let active = true;
    const fetchCount = async () => {
      try {
        const response = await fetch(API_ROUTES.MESSAGES.UNREAD_COUNT, {
          credentials: 'same-origin',
        });
        if (!response.ok) {
          return;
        }
        const body = await response.json();
        if (active && body?.success && typeof body.data?.count === 'number') {
          messagingActions.setUnreadCount(body.data.count);
        }
      } catch (err) {
        logger.error('Failed to fetch unread message count', err, 'Messages');
      }
    };

    fetchCount();

    // A new message in any of the user's conversations (RLS scopes the rows),
    // or their own read marker moving on another device.
    const channel = supabase
      .channel(`message-unread-count:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: DATABASE_TABLES.MESSAGES },
        () => fetchCount()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: DATABASE_TABLES.CONVERSATION_PARTICIPANTS,
          filter: `user_id=eq.${userId}`,
        },
        () => fetchCount()
      )
      .subscribe();

    window.addEventListener(MESSAGES_READ_EVENT, fetchCount);
    window.addEventListener('focus', fetchCount);

    return () => {
      active = false;
      supabase.removeChannel(channel);
      window.removeEventListener(MESSAGES_READ_EVENT, fetchCount);
      window.removeEventListener('focus', fetchCount);
    };
  }, [userId]);
}
