'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/browser';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { DATABASE_TABLES } from '@/config/database-tables';

/**
 * Fired after this tab changes notification state (mark read, delete). The
 * bell and the notification centre hold separate state; without this the
 * badge waited on a realtime event that a self-hosted socket can miss, and
 * kept its old number after "mark all read".
 */
export const NOTIFICATIONS_CHANGED_EVENT = 'orangecat:notifications-changed';

export function announceNotificationsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }
}

export function useUnreadNotifications() {
  const { user } = useAuth();
  const userId = user?.id;
  const [count, setCount] = useState(0);

  // Depend on userId rather than the full user object — Supabase auth
  // refresh emits a fresh User reference (~hourly) even when the id is
  // unchanged. Subscribing to `user` causes the channel to tear down +
  // resubscribe on every token refresh; using `userId` makes the effect
  // re-run only when the actual logged-in identity changes.
  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }

    const fetchCount = async () => {
      try {
        const response = await fetch(API_ROUTES.NOTIFICATIONS.UNREAD);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (data.success) {
          setCount(data.data.count);
        }
      } catch (err) {
        logger.error('Failed to fetch notification count', err, 'Notifications');
      }
    };

    fetchCount();

    // Channel name includes userId so two simultaneous mounts (e.g.,
    // bell badge + notification center) get separate channels and
    // don't tear each other down on unmount.
    const channel = supabase
      .channel(`notification-count:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: DATABASE_TABLES.NOTIFICATIONS,
          filter: `user_id=eq.${userId}`,
        },
        () => fetchCount()
      )
      .subscribe();

    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, fetchCount);
    window.addEventListener('focus', fetchCount);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, fetchCount);
      window.removeEventListener('focus', fetchCount);
    };
  }, [userId]);

  return { count };
}
