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
import { notificationActionLabel } from '@/config/notification-types';

function getNotificationIcon(notification: Notification) {
  switch (notification.type) {
    case 'payment':
    case 'project_funded':
    case 'tip_dead_end':
      return <Bitcoin className="w-5 h-5 text-bitcoinOrange" />;
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
  const actionLabel = notificationActionLabel(notification);
  return (
    <div
      className={`group relative rounded-md border p-3 transition-colors ${
        notification.is_read
          ? 'border-subtle bg-surface-page hover:bg-surface-raised'
          : 'border-strong bg-surface-raised hover:bg-surface-raised/80'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{getNotificationIcon(notification)}</div>

        <div className="flex-1 min-w-0">
          {/* The notification itself is the button: reachable by Tab, with a
              focus ring. Its ::after covers the card, so a tap anywhere on it
              still opens it; the small actions sit above that layer. */}
          <button
            type="button"
            onClick={() => onClick(notification)}
            className="block w-full cursor-pointer rounded-sm pr-4 text-left after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="block text-sm font-medium text-fg-primary">
              {notificationTitle(notification)}
            </span>
            {notification.message && notification.message !== notificationTitle(notification) && (
              <span
                className={`mt-1 block text-sm ${notification.is_read ? 'text-fg-secondary' : 'text-fg-primary'}`}
              >
                {notification.message}
              </span>
            )}
            {actionLabel && (
              <span className="mt-1 block text-sm font-medium text-fg-primary underline underline-offset-2">
                {actionLabel}
              </span>
            )}
          </button>

          {/* The actions share the time's line, so the words keep the card's
              full width. Where there is no hover to reveal them (a phone),
              they are always shown: a hidden button there is still tappable. */}
          <div className="relative z-10 mt-1 flex items-center justify-between gap-2">
            <p className="mb-0 text-xs text-fg-secondary">
              {formatRelativeTime(notification.created_at)}
            </p>

            <div className="-my-1.5 -mr-2 flex items-center gap-1 transition-opacity pointer-fine:opacity-0 group-hover:opacity-100 focus-within:opacity-100">
              {notification.type !== 'message' && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onAskCat(notification);
                  }}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-1 hover:bg-surface-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Ask the Cat about this"
                  aria-label="Ask the Cat about this"
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
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-1 hover:bg-surface-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Mark as read"
                  aria-label="Mark as read"
                >
                  <Check className="w-3 h-3 text-status-positive" />
                </button>
              )}
              <button
                onClick={e => {
                  e.stopPropagation();
                  onDelete(notification.id);
                }}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-1 hover:bg-surface-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Delete notification"
                aria-label="Delete notification"
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
