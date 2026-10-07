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
] as const;

export type InAppNotificationType = (typeof IN_APP_NOTIFICATION_TYPES)[number];
