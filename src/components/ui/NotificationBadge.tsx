/**
 * Notification Badge Component
 *
 * Reusable badge for displaying notification counts.
 * Follows DRY principle - used across messages, notifications, etc.
 *
 * Created: 2026-01-16
 */

import { cn } from '@/lib/utils';

interface NotificationBadgeProps {
  /** Number of unread items */
  count: number;
  /**
   * Maximum number to display before showing "N+". 99, like the sidebar and
   * conversation list: at 9 the bell read "9+" while its panel said 80, which
   * reads as two systems disagreeing rather than as a cap.
   */
  maxDisplay?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Notification badge for displaying unread counts
 *
 * The ink is text-fg-inverted, not white: dark mode's red is light
 * (--status-negative 0 75% 60%), and white on it was 3.8:1 at 10px. The
 * inverted ink flips with it (4.6:1 dark, 4.8:1 light), as on the
 * notification centre's own count. The control holding the badge names the
 * count in its own label ("Notifications (3 unread)"), so the badge carries
 * none: an aria-label is not allowed on a plain span, and the control's own
 * label replaces whatever is inside it.
 *
 * @example
 * <NotificationBadge count={5} />
 * <NotificationBadge count={150} /> // Shows "99+"
 */
export function NotificationBadge({ count, maxDisplay = 99, className }: NotificationBadgeProps) {
  if (count === 0) {
    return null;
  }

  return (
    <span
      className={cn(
        'absolute top-1 right-1 bg-status-negative text-fg-inverted text-2xs rounded-full h-4 min-w-4 px-1 flex items-center justify-center font-semibold leading-none',
        className
      )}
    >
      {count > maxDisplay ? `${maxDisplay}+` : count}
    </span>
  );
}
