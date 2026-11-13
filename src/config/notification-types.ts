/**
 * In-app notification types — the one list.
 *
 * public.notifications.type has a CHECK listing the types it accepts. It was a
 * third copy of this list (with a union in lib/services/notifications.ts and
 * bare strings at every dispatch site), and it drifted: booking_request,
 * booking_update and deal_review were dispatched for weeks and every insert
 * was rejected — the dispatcher logs and carries on, so nobody was told about
 * a booking request or a deal waiting for review. Found 2026-10-07 replaying
 * the migrations and inserting each dispatched type.
 *
 * Now the dispatcher and the service take `InAppNotificationType`, so a new
 * type is a build error until it is added here, and
 * __tests__/unit/config/notification-types.test.ts fails until the newest
 * migration's CHECK lists exactly these.
 */

export const IN_APP_NOTIFICATION_TYPES = [
  'follow',
  'payment',
  'project_funded',
  'message',
  'comment',
  'like',
  'mention',
  'system',
  'task_attention',
  'task_request',
  'task_completed',
  'task_broadcast',
  'match',
  'tip_dead_end',
  'booking_request',
  'booking_update',
  'deal_review',
  // Events: a ticket was issued to you; you were put on an event's crew.
  'ticket',
  'crew',
  // Someone invited you to a group; the group page asks you to accept.
  'group_invite',
  // Someone opened a project's investor room for the first time (ADR-0012).
  'room_opened',
] as const;

export type InAppNotificationType = (typeof IN_APP_NOTIFICATION_TYPES)[number];

/**
 * Which filter in the bell panel each type sits under. The filters matched one
 * literal type each, so Payments hid a Bitcoin tip (`tip_dead_end`) and Social
 * showed follows but never a mention, a comment or a group invite. A `Record`
 * over the list, so a new type is a build error until it has a category.
 */
export type NotificationFilterCategory = 'payments' | 'social' | 'messages' | 'other';

export const NOTIFICATION_TYPE_CATEGORY: Record<InAppNotificationType, NotificationFilterCategory> =
  {
    payment: 'payments',
    project_funded: 'payments',
    tip_dead_end: 'payments',
    booking_request: 'payments',
    booking_update: 'payments',
    deal_review: 'payments',
    room_opened: 'payments',
    ticket: 'payments',
    follow: 'social',
    comment: 'social',
    like: 'social',
    mention: 'social',
    match: 'social',
    crew: 'social',
    group_invite: 'social',
    message: 'messages',
    system: 'other',
    task_attention: 'other',
    task_request: 'other',
    task_completed: 'other',
    task_broadcast: 'other',
  };

/** The categories the bell panel offers as filters. */
export const NOTIFICATION_FILTER_CATEGORIES = ['payments', 'social', 'messages'] as const;

export function isNotificationFilterCategory(
  value: string
): value is (typeof NOTIFICATION_FILTER_CATEGORIES)[number] {
  return (NOTIFICATION_FILTER_CATEGORIES as readonly string[]).includes(value);
}

/** Every type a category covers. */
export function notificationTypesIn(category: NotificationFilterCategory): InAppNotificationType[] {
  return IN_APP_NOTIFICATION_TYPES.filter(type => NOTIFICATION_TYPE_CATEGORY[type] === category);
}

/** Whether a notification belongs in a list fetched with `filter` (the API's own rule). */
export function matchesNotificationFilter(
  notification: { type: string; is_read?: boolean },
  filter: string
): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'unread') {
    return !notification.is_read;
  }
  if (isNotificationFilterCategory(filter)) {
    return NOTIFICATION_TYPE_CATEGORY[notification.type as InAppNotificationType] === filter;
  }
  return notification.type === filter;
}

/**
 * What opening a notification does, said on the card. Only where it leads
 * somewhere: its `action_url`, or Messages for a message. The card used to be
 * a clickable box with no words saying so ("Someone tried to tip you … Add
 * one", and nothing to press).
 */
const ACTION_LABELS: Partial<Record<InAppNotificationType, string>> = {
  tip_dead_end: 'Add a wallet',
  message: 'Open messages',
  group_invite: 'See the invitation',
  ticket: 'See the event',
  crew: 'See the event',
};

export function notificationActionLabel(notification: {
  type: string;
  action_url?: string | null;
}): string | null {
  if (notification.type !== 'message' && !notification.action_url) {
    return null;
  }
  return ACTION_LABELS[notification.type as InAppNotificationType] ?? 'Open';
}
