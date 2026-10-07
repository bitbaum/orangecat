/**
 * TIMELINE TYPES - Comprehensive TypeScript Definitions
 *
 * Defines all timeline-related types for the unified activity feed system.
 * Supports project milestones, user activities, community events, and Bitcoin transactions.
 *
 * Created: 2025-11-13
 * Last Modified: 2025-11-13
 * Last Modified Summary: Initial creation of comprehensive timeline types
 */

import { LucideIcon } from 'lucide-react';

// ==================== EVENT TYPES ====================

/**
 * Primary event types supported by the timeline system
 */
export type TimelineEventType =
  // Post events (user-generated content)
  | 'post_created'
  | 'post_shared'
  | 'post_liked'
  | 'post_commented'
  | 'status_update'
  | 'quote_reply'
  | 'achievement_shared'
  | 'reflection_posted'

  // Project events
  | 'project_created'
  | 'project_published'
  | 'project_updated'
  | 'project_paused'
  | 'project_resumed'
  | 'project_completed'
  | 'project_cancelled'
  | 'project_funded'
  | 'project_milestone'
  | 'project_goal_reached'

  // Transaction events
  | 'support_received'
  | 'support_sent'
  | 'bitcoin_transaction'
  | 'lightning_payment'

  // Social events
  | 'user_followed'
  | 'user_unfollowed'
  | 'project_liked'
  | 'project_shared'
  | 'comment_added'
  | 'comment_liked'
  | 'profile_updated'
  | 'verification_achieved'

  // Community events
  | 'organization_joined'
  | 'organization_left'
  | 'organization_created'
  | 'event_created'
  | 'event_attended'
  | 'collaboration_started'

  // System events
  | 'achievement_unlocked'
  | 'badge_earned'
  | 'level_up'
  | 'streak_maintained';

/**
 * Event subtypes for more granular classification
 */
export type TimelineEventSubtype =
  | 'first_donation'
  | 'repeat_donation'
  | 'large_donation'
  | 'goal_25_percent'
  | 'goal_50_percent'
  | 'goal_75_percent'
  | 'goal_100_percent'
  | 'first_follower'
  | 'first_like'
  | 'first_comment'
  | 'verification_basic'
  | 'verification_premium'
  | 'milestone_funded'
  | 'milestone_completed';

/**
 * Actor types that can perform actions
 */
export type TimelineActorType = 'user' | 'organization' | 'system';

/**
 * Subject types that events can be about
 */
export type TimelineSubjectType =
  | 'project'
  | 'profile'
  | 'organization'
  | 'transaction'
  | 'comment'
  | 'event'
  | 'achievement'
  | 'system';

/**
 * Visibility levels for timeline events
 */
export type TimelineVisibility = 'public' | 'followers' | 'private';

/**
 * Image attached to a short post, stored verbatim at `metadata.image`
 * (snake_case to match the other metadata keys). The URL is either a CC0/PD
 * Openverse remote, an AI-generated image persisted to our storage, or the
 * user's own upload — the picker decides, this shape doesn't care.
 */
export interface PostImageMeta {
  url: string;
  alt: string;
  /** Creator attribution shown under the image when present. */
  credit: string | null;
  license: string | null;
  source_url: string | null;
}

/** Writer-side mapping from a picker selection to `metadata.image` — kept
 * next to the reader below so the two halves of the contract stay adjacent. */
export function toPostImageMeta(img: {
  fullUrl: string;
  title: string;
  creator: string | null;
  license: string;
  sourceUrl: string | null;
}): PostImageMeta {
  return {
    url: img.fullUrl,
    alt: img.title,
    credit: img.creator,
    license: img.license || null,
    source_url: img.sourceUrl,
  };
}

/**
 * An event's free-form `metadata` column, with the keys the timeline UI reads
 * named. Every key is optional — each writer sets only what applies — and
 * anything else a writer stores stays reachable as `unknown`.
 */
export interface TimelineEventMetadata {
  [key: string]: unknown;
  /** Read only through {@link getPostImage}, which validates it. */
  image?: unknown;
  is_repost?: boolean;
  is_quote_repost?: boolean;
  is_user_post?: boolean;
  is_cat_reply?: boolean;
  is_article?: boolean;
  /** `slug` is type-checked at the read site before use. */
  article?: { slug?: unknown } | null;
  original_event_id?: string;
  original_actor_id?: string;
  original_actor_name?: string;
  original_actor_username?: string;
  original_actor_avatar?: string | null;
  original_description?: string;
}

/** SSOT reader for `metadata.image` — every render surface goes through this. */
export function getPostImage(metadata: Record<string, unknown> | undefined): PostImageMeta | null {
  const img = metadata?.image as { url?: unknown } | null | undefined;
  return img && typeof img === 'object' && typeof img.url === 'string' && img.url
    ? (img as PostImageMeta)
    : null;
}

// ==================== CORE TIMELINE EVENT ====================

/**
 * Complete timeline event structure
 */
export interface TimelineEvent {
  // Primary identifiers
  id: string;
  eventType: TimelineEventType;
  eventSubtype?: TimelineEventSubtype;

  // Actor information
  actorId: string;
  actorType: TimelineActorType;

  // Subject information (what the event is about)
  subjectType: TimelineSubjectType;
  subjectId?: string;

  // Target information (who/what is affected)
  targetType?: TimelineSubjectType;
  targetId?: string;

  // Content
  title: string;
  description?: string;
  content?: TimelineEventContent;

  // Quantitative data
  amountBtc?: number;
  quantity?: number;

  // Context data
  locationData?: TimelineLocationData;
  deviceInfo?: TimelineDeviceInfo;

  // Privacy and display
  visibility: TimelineVisibility;
  isFeatured: boolean;

  // Timestamps
  eventTimestamp: string;
  createdAt: string;
  updatedAt: string;

  // Metadata

  metadata?: TimelineEventMetadata;
  tags?: string[];

  // Relationships
  parentEventId?: string;
  threadId?: string;

  // Status
  isDeleted: boolean;
  deletedAt?: string;
  deletionReason?: string;
}

/**
 * Rich content for timeline events
 */
interface TimelineEventContent {
  text?: string;
  images?: string[];
  links?: TimelineLink[];
  embeds?: TimelineEmbed[];
  mentions?: TimelineMention[];
  hashtags?: string[];
}

/**
 * Link within timeline event content
 */
interface TimelineLink {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  type?: 'internal' | 'external';
}

/**
 * Embedded content (videos, etc.)
 */
interface TimelineEmbed {
  type: 'video' | 'image' | 'link' | 'project' | 'profile';
  url: string;
  title?: string;
  thumbnail?: string;

  metadata?: Record<string, unknown>;
}

/**
 * User mentions in content
 */
interface TimelineMention {
  userId: string;
  username: string;
  displayName?: string;
  position: number;
}

// ==================== LOCATION & DEVICE DATA ====================

/**
 * Geographic location data
 */
interface TimelineLocationData {
  latitude?: number;
  longitude?: number;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  accuracy?: number;
}

/**
 * Device and browser information
 */
interface TimelineDeviceInfo {
  userAgent?: string;
  platform?: string;
  browser?: string;
  version?: string;
  mobile?: boolean;
  screenResolution?: string;
  language?: string;
}

// ==================== UI & DISPLAY TYPES ====================

/**
 * Timeline event for UI display (enriched with computed data)
 */
export interface TimelineDisplayEvent extends Omit<TimelineEvent, 'eventType' | 'eventSubtype'> {
  // UI-specific fields
  icon: LucideIcon;
  displayType: string;
  displaySubtype?: string;

  // Enriched actor info
  actor: {
    id: string;
    name: string;
    username?: string;
    avatar?: string;
    type: TimelineActorType;
  };

  // Enriched subject/target info
  subject?: {
    id: string;
    name: string;
    type: TimelineSubjectType;
    url?: string;
  };

  target?: {
    id: string;
    name: string;
    type: TimelineSubjectType;
    url?: string;
  };

  // Formatted content
  formattedAmount?: string;
  timeAgo: string;
  isRecent: boolean;

  // Interaction data
  likesCount?: number;
  dislikesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  repostsCount?: number;
  userLiked?: boolean;
  userDisliked?: boolean;
  userShared?: boolean;
  userCommented?: boolean;
  userReposted?: boolean;

  // Threading
  replies?: TimelineDisplayEvent[];
  replyCount?: number;
  parentPostId?: string;
  threadId?: string;
  threadDepth?: number;
  isQuoteReply?: boolean;
  threadRepliesCount?: number;
  quotedContent?: string;
  threadParticipants?: Array<{
    id: string;
    name: string;
    username: string;
    avatar?: string;
  }>;
}

/**
 * Timeline filtering options
 */
export interface TimelineFilters {
  eventTypes: TimelineEventType[];
  dateRange: 'today' | 'week' | 'month' | 'year' | 'all';
  visibility: TimelineVisibility[];
  actors: string[]; // User IDs
  subjects: string[]; // Project/Organization IDs
  tags: string[];
  sortBy?: 'recent' | 'trending' | 'popular';
  search?: string; // Search query for filtering events
  amountRange?: {
    min: number;
    max: number;
    // BTC is the canonical unit — satoshis are not a product concept.
    currency: 'btc';
  };
}

/**
 * Timeline pagination
 */
export interface TimelinePagination {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ==================== API TYPES ====================

/**
 * API response for timeline feed
 */
export interface TimelineFeedResponse {
  events: TimelineDisplayEvent[];
  pagination: TimelinePagination;
  filters: TimelineFilters;
  metadata: {
    totalEvents: number;
    featuredEvents: number;
    lastUpdated: string;
  };
}

/**
 * Response for thread posts endpoint
 */
export interface ThreadPostsResponse {
  success: boolean;
  posts?: TimelineDisplayEvent[];
  total?: number;
  error?: string;
}

/**
 * API request to create timeline event
 */
export interface CreateTimelineEventRequest {
  eventType: TimelineEventType;
  eventSubtype?: TimelineEventSubtype;
  actorId?: string; // Optional, defaults to current user
  subjectType: TimelineSubjectType;
  subjectId?: string;
  targetType?: TimelineSubjectType;
  targetId?: string;
  title: string;
  description?: string;
  content?: TimelineEventContent;
  amountBtc?: number;
  quantity?: number;
  visibility?: TimelineVisibility;
  isFeatured?: boolean;

  metadata?: Record<string, unknown>;
  tags?: string[];
  parentEventId?: string;
  threadId?: string;
}

/**
 * Timeline event creation response
 */
export interface TimelineEventResponse {
  success: boolean;
  event?: TimelineEvent | TimelineDisplayEvent;
  error?: string;

  metadata?: Record<string, unknown>;
}

// ==================== UTILITY TYPES ====================

/**
 * Timeline event for database operations
 */
export interface TimelineEventDb extends Omit<
  TimelineEvent,
  'eventType' | 'eventSubtype' | 'actorType' | 'subjectType' | 'targetType' | 'visibility'
> {
  event_type: string;
  event_subtype?: string;
  actor_type: string;
  subject_type: string;
  target_type?: string;
  visibility: string;
  amount_btc?: number;
  location_data?: TimelineLocationData;
  device_info?: TimelineDeviceInfo;
  is_featured: boolean;
  event_timestamp: string;
  created_at: string;
  updated_at: string;

  metadata?: TimelineEventMetadata;
  tags?: string[];
  parent_event_id?: string;
  thread_id?: string;
  is_deleted: boolean;
  deleted_at?: string;
  deletion_reason?: string;
}
