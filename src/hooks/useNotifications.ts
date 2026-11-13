'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { matchesNotificationFilter, type InAppNotificationType } from '@/config/notification-types';
import { useNotificationsMutations } from './useNotificationsMutations';
import { useNotificationsRealtime } from './useNotificationsRealtime';

export interface Notification {
  id: string;
  type: InAppNotificationType;
  message: string;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  // Live schema folds the human-readable title and any source actor/entity ids
  // into metadata (see buildNotificationRow / NotificationDispatcher).
  metadata: Record<string, unknown> & { title?: string };
}

/** Human-readable heading for a notification (title lives in metadata). */
export function notificationTitle(n: Notification): string {
  return n.metadata?.title ?? n.message;
}

interface UseNotificationsOptions {
  filter?: 'all' | 'unread' | string;
  limit?: number;
  realtime?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { filter = 'all', limit = 20, realtime = true } = options;
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Pagination cursor. A ref, not state: it is only read inside fetchNotifications
  // and must NOT be a dependency of it — otherwise advancing the cursor recreates
  // fetchNotifications, which is an effect dependency, re-running the load effect
  // and double-fetching page 1 on every mount / filter change.
  const offsetRef = useRef(0);
  const [total, setTotal] = useState(0);

  const fetchNotifications = useCallback(
    async (reset = false) => {
      if (!user) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const currentOffset = reset ? 0 : offsetRef.current;
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: currentOffset.toString(),
          filter,
        });

        const response = await fetch(`${API_ROUTES.NOTIFICATIONS.BASE}?${params}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data?.error?.message ?? `Failed to fetch notifications (${response.status})`
          );
        }
        if (!data.success) {
          throw new Error(data.error?.message || 'Failed to fetch notifications');
        }

        if (reset) {
          setNotifications(data.data.notifications);
          offsetRef.current = limit;
        } else {
          setNotifications(prev => [...prev, ...data.data.notifications]);
          offsetRef.current = currentOffset + limit;
        }
        setTotal(data.data.total);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    },
    [user, limit, filter]
  );

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const response = await fetch(API_ROUTES.NOTIFICATIONS.UNREAD);
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      if (data.success) {
        setUnreadCount(data.data.count);
      }
    } catch (err) {
      logger.error('Failed to fetch unread count', err, 'Notifications');
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotifications(true);
      fetchUnreadCount();
    }
  }, [user, filter, fetchNotifications, fetchUnreadCount]);

  const handleInsert = useCallback(
    (notification: Notification) => {
      setUnreadCount(prev => prev + 1);
      // A live arrival joins the list only if the open filter would have
      // fetched it: a message does not belong under Payments.
      if (matchesNotificationFilter(notification, filter)) {
        setNotifications(prev => [notification, ...prev]);
        setTotal(prev => prev + 1);
      }
    },
    [filter]
  );

  const handleUpdate = useCallback(
    (updated: Record<string, unknown>) => {
      setNotifications(prev =>
        prev.map(n => (n.id === (updated as { id: string }).id ? { ...n, ...updated } : n))
      );
      fetchUnreadCount();
    },
    [fetchUnreadCount]
  );

  const handleDelete = useCallback(
    (id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
      setTotal(prev => prev - 1);
      fetchUnreadCount();
    },
    [fetchUnreadCount]
  );

  useNotificationsRealtime({
    user,
    enabled: realtime,
    onInsert: handleInsert,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
  });

  const loadMore = useCallback(async () => {
    if (isLoading || notifications.length >= total) {
      return;
    }
    await fetchNotifications(false);
  }, [isLoading, notifications.length, total, fetchNotifications]);

  const { markAsRead, deleteNotification, clearRead } = useNotificationsMutations({
    setNotifications,
    setUnreadCount,
    setTotal,
  });

  const refresh = useCallback(async () => {
    await fetchNotifications(true);
    await fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    hasMore: notifications.length < total,
    loadMore,
    markAsRead,
    deleteNotification,
    clearRead,
    refresh,
  };
}
