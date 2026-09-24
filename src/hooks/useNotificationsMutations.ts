'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import type { Notification } from './useNotifications';
import { announceNotificationsChanged } from './useUnreadNotifications';

interface MutationSetters {
  setNotifications: Dispatch<SetStateAction<Notification[]>>;
  setUnreadCount: Dispatch<SetStateAction<number>>;
  setTotal: Dispatch<SetStateAction<number>>;
}

interface UseNotificationsMutationsReturn {
  markAsRead: (id: string | string[] | 'all') => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearRead: () => Promise<void>;
}

export function useNotificationsMutations({
  setNotifications,
  setUnreadCount,
  setTotal,
}: MutationSetters): UseNotificationsMutationsReturn {
  const markAsRead = useCallback(
    async (id: string | string[] | 'all') => {
      try {
        const body = id === 'all' ? { all: true } : Array.isArray(id) ? { ids: id } : { id };

        const response = await fetch(API_ROUTES.NOTIFICATIONS.READ, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error?.message ?? `Request failed (${response.status})`);
        }
        if (!data.success) {
          throw new Error(data.error?.message || 'Failed to mark notifications as read');
        }

        if (id === 'all') {
          setNotifications(prev =>
            prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
          );
          setUnreadCount(0);
        } else {
          const ids = Array.isArray(id) ? id : [id];
          setNotifications(prev =>
            prev.map(n =>
              ids.includes(n.id) ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
            )
          );
          setUnreadCount(prev => Math.max(0, prev - ids.length));
        }
        announceNotificationsChanged();
      } catch (err) {
        logger.error('Failed to mark as read', err, 'Notifications');
        throw err;
      }
    },
    [setNotifications, setUnreadCount]
  );

  const deleteNotification = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`${API_ROUTES.NOTIFICATIONS.BASE}?id=${id}`, {
          method: 'DELETE',
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error?.message ?? `Request failed (${response.status})`);
        }
        if (!data.success) {
          throw new Error(data.error?.message || 'Failed to delete notification');
        }

        setNotifications(prev => {
          const notification = prev.find(n => n.id === id);
          if (notification && !notification.is_read) {
            setUnreadCount(c => Math.max(0, c - 1));
          }
          return prev.filter(n => n.id !== id);
        });
        setTotal(prev => prev - 1);
        announceNotificationsChanged();
      } catch (err) {
        logger.error('Failed to delete notification', err, 'Notifications');
        throw err;
      }
    },
    [setNotifications, setUnreadCount, setTotal]
  );

  const clearRead = useCallback(async () => {
    try {
      const response = await fetch(API_ROUTES.NOTIFICATIONS.CLEAR_READ, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message ?? `Request failed (${response.status})`);
      }
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to clear read notifications');
      }

      setNotifications(prev => prev.filter(n => !n.is_read));
      setTotal(prev => prev - (data.data.deleted || 0));
    } catch (err) {
      logger.error('Failed to clear read notifications', err, 'Notifications');
      throw err;
    }
  }, [setNotifications, setTotal]);

  return { markAsRead, deleteNotification, clearRead };
}
