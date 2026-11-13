/**
 * Header Action Buttons
 *
 * Messages and Notifications triggers for the global header rail. Both render
 * through the shared HeaderIconButton primitive so size, icon weight, radius
 * and badge placement stay identical to the rest of the rail.
 */

'use client';

import type { Ref } from 'react';
import { MessageSquare, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUnreadCount } from '@/stores/messaging';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { HeaderIconButton } from './HeaderIconButton';
import { ROUTES } from '@/config/routes';

/**
 * Messages button with unread count
 */
export function MessagesButton() {
  const router = useRouter();
  const unreadCount = useUnreadCount();

  return (
    <HeaderIconButton
      icon={MessageSquare}
      label={`Messages ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      onClick={() => router.push(ROUTES.MESSAGES)}
      badgeCount={unreadCount}
    />
  );
}

/**
 * Notifications button with unread count
 */
export function NotificationsButton({
  onClick,
  isOpen = false,
  ref,
}: {
  onClick: () => void;
  /** Whether the notification center it controls is currently open. */
  isOpen?: boolean;
  /** The bell, so the notification center can hand focus back to it. */
  ref?: Ref<HTMLButtonElement>;
}) {
  const { count: unreadCount } = useUnreadNotifications();

  return (
    <HeaderIconButton
      ref={ref}
      icon={Bell}
      label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      onClick={onClick}
      badgeCount={unreadCount}
      active={isOpen}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
    />
  );
}
