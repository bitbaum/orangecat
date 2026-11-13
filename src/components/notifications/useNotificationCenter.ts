'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useNotifications, notificationTitle, type Notification } from '@/hooks/useNotifications';
import { ROUTES } from '@/config/routes';

type UIFilter = 'all' | 'unread' | 'payments' | 'social' | 'messages';

function getAPIFilter(uiFilter: UIFilter): 'all' | 'unread' | string {
  switch (uiFilter) {
    case 'payments':
      return 'payment';
    case 'social':
      return 'follow';
    case 'messages':
      return 'message';
    default:
      return uiFilter;
  }
}

interface UseNotificationCenterParams {
  onClose: () => void;
}

export function useNotificationCenter({ onClose }: UseNotificationCenterParams) {
  const router = useRouter();
  const [uiFilter, setUIFilter] = useState<UIFilter>('all');

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    hasMore,
    loadMore,
    markAsRead,
    deleteNotification,
    clearRead,
    refresh,
  } = useNotifications({
    filter: getAPIFilter(uiFilter),
    limit: 20,
    realtime: true,
  });

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAsRead('all');
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotification(id);
      toast.success('Notification deleted');
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const handleClearRead = async () => {
    try {
      await clearRead();
      toast.success('Cleared read notifications');
    } catch {
      toast.error('Failed to clear notifications');
    }
  };

  // Hand the notification to the Cat: open the chat with a prepared question so
  // the Cat explains the alert and helps resolve it (its context includes the
  // user's unread notifications, and system alerts can trigger a live health
  // check). This is the "the Cat should be helping with this" path.
  const handleAskCat = (notification: Notification) => {
    const title = notificationTitle(notification);
    const body =
      notification.message && notification.message !== title ? ` — "${notification.message}"` : '';
    const question = `Help me with this notification: ${title}${body}. What does it mean and what should I do?`;
    router.push(`${ROUTES.DASHBOARD.CAT}?q=${encodeURIComponent(question)}`);
    onClose();
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }
    if (notification.type === 'message') {
      // Messages is one screen (ROUTES.MESSAGES), not a second messenger in a
      // dialog over the bell.
      router.push(ROUTES.MESSAGES);
      onClose();
      return;
    }
    if (notification.action_url) {
      router.push(notification.action_url);
      onClose();
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    uiFilter,
    setUIFilter,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleDeleteNotification,
    handleClearRead,
    handleNotificationClick,
    handleAskCat,
  };
}

export type { UIFilter };
