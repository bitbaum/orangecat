'use client';

import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import {
  Bell,
  Calendar,
  Check,
  Bitcoin,
  Users,
  MessageSquare,
  Heart,
  AtSign,
  Settings,
  Trash2,
} from 'lucide-react';
import { formatRelativeTime } from '@/utils/dates';
import { notificationTitle, type Notification } from '@/hooks/useNotifications';

function getNotificationIcon(notification: Notification) {
  switch (notification.type) {
    case 'payment':
    case 'project_funded':
    case 'tip_dead_end':
      return <Bitcoin className="w-5 h-5 text-bitcoin-orange" />;
    case 'follow':
      return <Users className="w-5 h-5 text-fg-primary" />;
    case 'message':
      return <MessageSquare className="w-5 h-5 text-fg-primary" />;
    case 'comment':
      return <MessageSquare className="w-5 h-5 text-status-positive" />;
    case 'like':
      return <Heart className="w-5 h-5 text-status-negative" />;
    case 'mention':
      return <AtSign className="w-5 h-5 text-fg-primary" />;
    case 'booking_request':
    case 'booking_update':
      return <Calendar className="w-5 h-5 text-fg-primary" />;
    case 'system':
      return <Settings className="w-5 h-5 text-fg-secondary" />;
    default:
      return <Bell className="w-5 h-5 text-fg-secondary" />;
  }
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (notification: Notification) => void;
  /** Open the Cat chat with this notification as a prepared question. */
  onAskCat: (notification: Notification) => void;
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClick,
  onAskCat,
}: NotificationItemProps) {
  return (
    <div
      className={`group relative cursor-pointer rounded-md border p-3 transition-colors ${
        notification.is_read
          ? 'border-subtle bg-surface-page hover:bg-surface-raised'
          : 'border-strong bg-surface-raised hover:bg-surface-raised/80'
      }`}
      onClick={() => onClick(notification)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getNotificationIcon(notification)}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-fg-primary">
                {notificationTitle(notification)}
              </h4>
              {notification.message && notification.message !== notificationTitle(notification) && (
                <p
                  className={`text-sm mt-1 ${notification.is_read ? 'text-fg-secondary' : 'text-fg-primary'}`}
                >
                  {notification.message}
                </p>
              )}
              <p className="text-xs text-fg-secondary mt-2">
                {formatRelativeTime(notification.created_at)}
              </p>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {notification.type !== 'message' && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onAskCat(notification);
                  }}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-1 hover:bg-surface-page"
                  title="Ask the Cat about this"
                >
                  <BrandMarkIcon className="w-3 h-3 text-fg-primary" />
                </button>
              )}
              {!notification.is_read && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onMarkAsRead(notification.id);
                  }}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-1 hover:bg-surface-page"
                  title="Mark as read"
                >
                  <Check className="w-3 h-3 text-status-positive" />
                </button>
              )}
              <button
                onClick={e => {
                  e.stopPropagation();
                  onDelete(notification.id);
                }}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-1 hover:bg-surface-page"
                title="Delete notification"
              >
                <Trash2 className="w-3 h-3 text-status-negative" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {!notification.is_read && (
        <div className="absolute right-3 top-3 h-2 w-2 rounded-sm bg-fg-primary" />
      )}
    </div>
  );
}
