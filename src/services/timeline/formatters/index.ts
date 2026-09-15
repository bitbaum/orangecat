/**
 * Timeline Formatters
 *
 * Handles all display formatting and transformation logic for timeline events.
 * Single responsibility: Convert database events to display-ready format.
 *
 * Created: 2025-01-28
 * Last Modified: 2025-01-28
 * Last Modified Summary: Extracted formatting logic from monolithic timeline service
 */

import type { LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/services/currency';
import { APP_LOCALE } from '@/utils/locale';
import {
  Heart,
  MessageCircle,
  Share2,
  Rocket,
  Zap,
  Trophy,
  Target,
  Bitcoin,
  User,
  Users,
  Star,
  TrendingUp,
  Calendar,
  Award,
  BookOpen,
  Plus,
  Minus,
} from 'lucide-react';
import type {
  TimelineEvent,
  TimelineEventType,
  TimelineEventDb,
  TimelineEventSubtype,
  TimelineActorType,
  TimelineSubjectType,
  TimelineVisibility,
} from '@/types/timeline';

/**
 * Helper to safely get a field that might be in snake_case or camelCase
 */
function getField<T>(obj: object, snakeCase: string, camelCase: string): T | undefined {
  const record = obj as Record<string, unknown>;
  return (record[snakeCase] as T) ?? (record[camelCase] as T) ?? undefined;
}

/**
 * Map database event to timeline event format
 */
export function mapDbEventToTimelineEvent(dbEvent: TimelineEventDb): TimelineEvent {
  return {
    id: dbEvent.id,
    eventType: dbEvent.event_type as TimelineEventType,
    eventSubtype: (dbEvent.event_subtype as TimelineEventSubtype) || undefined,
    actorId: getField<string>(dbEvent, 'actor_id', 'actorId') || '',
    actorType:
      (getField<string>(dbEvent, 'actor_type', 'actorType') as TimelineActorType) || 'user',
    subjectType:
      (getField<string>(dbEvent, 'subject_type', 'subjectType') as TimelineSubjectType) ||
      'profile',
    subjectId: getField<string>(dbEvent, 'subject_id', 'subjectId'),
    targetType: getField<string>(dbEvent, 'target_type', 'targetType') as
      TimelineSubjectType | undefined,
    targetId: getField<string>(dbEvent, 'target_id', 'targetId'),
    title: dbEvent.title,
    description: dbEvent.description || undefined,
    content: dbEvent.content,
    amountBtc: dbEvent.amount_btc || undefined,
    quantity: dbEvent.quantity || undefined,
    locationData: dbEvent.location_data,
    deviceInfo: dbEvent.device_info,
    visibility: dbEvent.visibility as TimelineVisibility,
    isFeatured: dbEvent.is_featured,
    eventTimestamp: dbEvent.event_timestamp,
    createdAt: dbEvent.created_at,
    updatedAt: dbEvent.updated_at,
    metadata: dbEvent.metadata,
    tags: dbEvent.tags,
    parentEventId: dbEvent.parent_event_id || undefined,
    threadId: dbEvent.thread_id || undefined,
    isDeleted: dbEvent.is_deleted,
    deletedAt: dbEvent.deleted_at || undefined,
    deletionReason: dbEvent.deletion_reason || undefined,
  };
}

/**
 * Get icon for event type
 */
export function getEventIcon(eventType: TimelineEventType): LucideIcon {
  const iconMap: Record<TimelineEventType, LucideIcon> = {
    // Post events
    post_created: BookOpen,
    post_shared: Share2,
    post_liked: Heart,
    post_commented: MessageCircle,
    status_update: BookOpen,
    quote_reply: MessageCircle,
    achievement_shared: Trophy,
    reflection_posted: Star,

    // Project events
    project_created: Plus,
    project_published: Rocket,
    project_updated: TrendingUp,
    project_paused: Minus,
    project_resumed: Plus,
    project_completed: Target,
    project_cancelled: Minus,
    project_funded: Bitcoin,
    project_milestone: Target,
    project_goal_reached: Trophy,

    // Transaction events
    support_received: Bitcoin,
    support_sent: Share2,
    bitcoin_transaction: Bitcoin,
    lightning_payment: Zap,

    // Social events
    user_followed: User,
    user_unfollowed: User,
    project_liked: Heart,
    project_shared: Share2,
    comment_added: MessageCircle,
    comment_liked: Heart,
    profile_updated: User,
    verification_achieved: Award,

    // Community events
    organization_joined: Users,
    organization_left: Users,
    organization_created: Users,
    event_created: Calendar,
    event_attended: Calendar,
    collaboration_started: Users,

    // System events
    achievement_unlocked: Trophy,
    badge_earned: Award,
    level_up: TrendingUp,
    streak_maintained: Star,
  };

  return iconMap[eventType] || BookOpen;
}

/**
 * Get display type for event
 */
export function getEventDisplayType(eventType: TimelineEventType): string {
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format amount for display
 */
export function formatAmount(event: TimelineEvent): string | undefined {
  if (event.amountBtc) {
    return formatCurrency(event.amountBtc, 'BTC');
  }
  return undefined;
}

/**
 * How old a post is, in the compact form a feed wants.
 *
 * `30s`, `5m`, `23h`, `6d`, then an absolute date — the convention every
 * timeline product converged on, because in a feed the age is a glance, not a
 * sentence. The post header was rendering "about 23 hours ago" (date-fns with
 * `addSuffix`), which is three times the width for the same fact and reads as
 * prose sitting inside a metadata line.
 *
 * No " ago" suffix: the position after the author's handle already says it is
 * an age, and every character here competes with the post itself. Callers pair
 * this with a `title`/`dateTime` carrying the exact timestamp, so precision is
 * one hover away and nothing is actually lost.
 *
 * Dates inside the current year omit it (`Aug 1`); older ones keep it
 * (`Aug 1, 2025`), so a year-old post can never be mistaken for a recent one.
 */
export function getTimeAgo(timestamp: string): string {
  const eventTime = new Date(timestamp);
  if (Number.isNaN(eventTime.getTime())) {
    return '';
  }

  const now = new Date();
  const diffSecs = Math.floor((now.getTime() - eventTime.getTime()) / 1000);

  // A clock skew or a just-written optimistic post can land microseconds in the
  // future; "now" is honest there, "-1m" is not.
  if (diffSecs < 60) {
    return diffSecs < 5 ? 'now' : `${Math.max(diffSecs, 0)}s`;
  }

  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) {
    return `${diffMins}m`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d`;
  }

  // Pinned to en-US, matching <html lang="en">. Passing `undefined` here takes
  // the BROWSER's locale, which rendered "22. Juli" inside an otherwise
  // entirely English interface for anyone with a non-English system — a post
  // dated in one language next to a "1d" in another. The app ships no
  // translations; when it does, this should follow the app's locale, not the
  // browser's, for exactly the same reason.
  const sameYear = eventTime.getFullYear() === now.getFullYear();
  return eventTime.toLocaleDateString(APP_LOCALE, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/**
 * Check if event is recent (within 24 hours)
 */
export function isEventRecent(timestamp: string): boolean {
  const now = new Date();
  const eventTime = new Date(timestamp);
  const diffHours = (now.getTime() - eventTime.getTime()) / (1000 * 60 * 60);
  return diffHours < 24;
}
