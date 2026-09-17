/**
 * TIMELINE SERVICE - Unified Activity Feed System
 *
 * Provides comprehensive timeline functionality for OrangeCat:
 * - Project milestones and funding events
 * - User activities and social interactions
 * - Community events and collaborations
 * - Bitcoin transaction tracking with rich context
 *
 * Created: 2025-11-13
 * Last Modified: 2025-01-28
 * Last Modified Summary: Refactored to orchestrator pattern - delegates to modular queries/mutations/utils
 */

import type {
  TimelineDisplayEvent,
  TimelineEventType,
  TimelineVisibility,
  TimelineFeedResponse,
  CreateTimelineEventRequest,
  TimelineEventResponse,
  TimelineFilters,
  TimelinePagination,
  ThreadPostsResponse,
} from '@/types/timeline';

// Import query functions
import {
  getUserFeed,
  getProjectFeed,
  getProfileFeed,
  getFollowedUsersFeed,
  getCommunityFeed,
  getEnrichedUserFeed,
  getEnrichedFollowingFeed,
  getEventById,
  getReplies,
  searchPosts,
  getThreadPosts,
} from './queries';

import { warmCurrentUserId } from '@/services/supabase/auth/session';

/**
 * Start learning who is reading before the feed query, not after it.
 *
 * Every feed read below ends in enrichment, and enrichment needs the reader's
 * id to mark which posts they already reacted to. That lookup is a round-trip
 * to /auth/v1/user, it depends on nothing in the feed, and it used to start
 * only once the feed came back — with the reaction queries then queued behind
 * it. Measured on a cold timeline load: feed 3147-3520ms, THEN /auth/v1/user
 * 3552-3784, THEN reactions 3811-4076.
 *
 * Applied here, at the one door every feed read goes through, rather than
 * repeated inside each query function.
 */
function withWarmReader<T>(run: () => Promise<T>): Promise<T> {
  warmCurrentUserId();
  return run();
}

// Import mutation functions
import {
  createEventWithVisibility,
  createEvent,
  createProjectEvent,
  createTransactionEvent,
  createQuoteReply,
  updateEvent,
  updateEventVisibility,
  deleteEvent,
  shareEvent,
} from './mutations/events';

// Import social interaction functions
import {
  toggleLike as toggleLikeEvent,
  toggleDislike as toggleDislikeEvent,
  addComment as addEventComment,
  updateComment as updateEventComment,
  deleteComment as deleteEventComment,
  getEventCounts,
  getEventComments,
  getCommentReplies,
} from './processors/socialInteractions';
import type { ToggleLikeResult, ToggleDislikeResult } from './processors/reactions';

// Import utilities
import { getDemoTimelineEvents } from './utils/demo';
import type { ServiceResult } from '@/types/common';

class TimelineService {
  // ==================== EVENT CREATION ====================

  /**
   * Create a new timeline event with visibility contexts (no duplicates)
   * This is the NEW preferred method for creating posts with cross-posting support
   */
  async createEventWithVisibility(
    request: CreateTimelineEventRequest & {
      timelineContexts?: Array<{
        timeline_type: 'profile' | 'project' | 'community';
        timeline_owner_id: string | null;
      }>;
    }
  ): Promise<TimelineEventResponse> {
    return createEventWithVisibility(request);
  }

  /**
   * Create a new timeline event (LEGACY - prefer createEventWithVisibility for posts)
   */
  async createEvent(request: CreateTimelineEventRequest): Promise<TimelineEventResponse> {
    return createEvent(request);
  }

  /**
   * Create project-related events automatically
   */
  async createProjectEvent(
    projectId: string,
    eventType: TimelineEventType,
    userId: string,
    additionalData?: Partial<CreateTimelineEventRequest>
  ): Promise<TimelineEventResponse> {
    return createProjectEvent(projectId, eventType, userId, additionalData);
  }

  /**
   * Create transaction-related events
   */
  async createTransactionEvent(
    transactionId: string,
    projectId: string,
    supporterId: string,
    amountBtc: number,
    eventType: 'support_received' | 'support_sent' = 'support_received'
  ): Promise<TimelineEventResponse> {
    return createTransactionEvent(transactionId, projectId, supporterId, amountBtc, eventType);
  }

  /**
   * Create a quote reply (different from quote repost)
   * Quote replies create threaded conversations for networked thoughts
   */
  async createQuoteReply(
    parentPostId: string,
    actorId: string,
    content: string,
    quotedContent: string,
    visibility: TimelineVisibility = 'public'
  ): Promise<TimelineEventResponse> {
    return createQuoteReply(
      parentPostId,
      actorId,
      content,
      quotedContent,
      visibility,
      getEventById
    );
  }

  // ==================== EVENT QUERYING ====================

  /**
   * Get user's personalized timeline feed
   */
  async getUserFeed(
    userId: string,
    filters?: Partial<TimelineFilters>,
    pagination?: Partial<TimelinePagination>
  ): Promise<TimelineFeedResponse> {
    return withWarmReader(() => getUserFeed(userId, filters, pagination));
  }

  /**
   * Get project timeline feed
   */
  async getProjectFeed(
    projectId: string,
    filters?: Partial<TimelineFilters>,
    pagination?: Partial<TimelinePagination>
  ): Promise<TimelineFeedResponse> {
    return withWarmReader(() => getProjectFeed(projectId, filters, pagination));
  }

  /**
   * Get profile timeline feed
   */
  async getProfileFeed(
    profileId: string,
    filters?: Partial<TimelineFilters>,
    pagination?: Partial<TimelinePagination>
  ): Promise<TimelineFeedResponse> {
    return withWarmReader(() => getProfileFeed(profileId, filters, pagination));
  }

  /**
   * Get community timeline (events from followed users)
   */
  async getFollowedUsersFeed(
    _userId: string,
    pagination?: Partial<TimelinePagination>
  ): Promise<TimelineFeedResponse> {
    // Note: getFollowedUsersFeed gets currentUserId internally
    return withWarmReader(() => getFollowedUsersFeed(undefined, pagination));
  }

  /**
   * Get public community timeline (posts from all users and projects)
   * Uses community_timeline_no_duplicates VIEW to eliminate duplicate cross-posts
   */
  async getCommunityFeed(
    filters?: Partial<TimelineFilters>,
    pagination?: Partial<TimelinePagination>
  ): Promise<TimelineFeedResponse> {
    return withWarmReader(() => getCommunityFeed(filters, pagination));
  }

  /**
   * Get enriched timeline feed with social interactions
   */
  async getEnrichedUserFeed(
    userId: string,
    filters?: Partial<TimelineFilters>,
    pagination?: Partial<TimelinePagination>
  ): Promise<TimelineFeedResponse> {
    return withWarmReader(() =>
      getEnrichedUserFeed(userId, filters, pagination, getDemoTimelineEvents)
    );
  }

  /** Home feed — posts from people/projects the user follows (+ own), no public firehose. */
  async getEnrichedFollowingFeed(
    userId: string,
    filters?: Partial<TimelineFilters>,
    pagination?: Partial<TimelinePagination>
  ): Promise<TimelineFeedResponse> {
    return withWarmReader(() => getEnrichedFollowingFeed(userId, filters, pagination));
  }

  /**
   * Get a single event by ID with full enrichment
   */
  async getEventById(
    eventId: string
  ): Promise<{ success: boolean; event?: TimelineDisplayEvent; error?: string }> {
    return withWarmReader(() => getEventById(eventId));
  }

  /**
   * Get replies to a specific event (thread-friendly, uses parent_event_id)
   * Builds a small reply tree to enable nested replies in the UI.
   */
  async getReplies(
    eventId: string,
    limit: number = 50
  ): Promise<{ success: boolean; replies?: TimelineDisplayEvent[]; error?: string }> {
    return withWarmReader(() => getReplies(eventId, limit));
  }

  /**
   * Search posts by query string
   * Searches in title, description, and actor names
   */
  async searchPosts(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    success: boolean;
    posts?: TimelineDisplayEvent[];
    total?: number;
    error?: string;
  }> {
    return withWarmReader(() => searchPosts(query, options));
  }

  /**
   * Get all posts in a thread
   */
  async getThreadPosts(threadId: string): Promise<ThreadPostsResponse> {
    const result = await withWarmReader(() => getThreadPosts(threadId));
    return {
      success: result.success,
      posts: result.posts || [],
      total: result.total || 0,
      error: result.error,
    };
  }

  // ==================== SOCIAL INTERACTIONS ====================

  /**
   * Like or unlike an event
   */
  async toggleLike(eventId: string, userId?: string): Promise<ToggleLikeResult> {
    return toggleLikeEvent(eventId, userId);
  }

  /**
   * Toggle dislike on a timeline event (for scam detection and wisdom of crowds)
   */
  async toggleDislike(eventId: string, userId?: string): Promise<ToggleDislikeResult> {
    return toggleDislikeEvent(eventId, userId);
  }

  /**
   * Share an event
   */
  async shareEvent(
    originalEventId: string,
    userId?: string,
    shareText?: string,
    visibility: TimelineVisibility = 'public'
  ): Promise<{ success: boolean; shareCount: number; error?: string }> {
    return shareEvent(originalEventId, userId, shareText, visibility);
  }

  /**
   * Add a comment to an event
   */
  async addComment(
    eventId: string,
    content: string,
    parentCommentId?: string,
    userId?: string
  ): Promise<{ success: boolean; commentId?: string; commentCount: number; error?: string }> {
    return addEventComment(eventId, content, parentCommentId, userId);
  }

  /**
   * Get like/comment counts for an event (fallback for feeds lacking counts)
   */
  async getEventCounts(eventId: string): Promise<{ likeCount: number; commentCount: number }> {
    return getEventCounts(eventId);
  }

  /**
   * Get comments for an event
   */
  async getEventComments(eventId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    return getEventComments(eventId, limit, offset);
  }

  /**
   * Update a comment's content
   */
  async updateComment(commentId: string, content: string, userId?: string): Promise<ServiceResult> {
    return updateEventComment(commentId, content, userId);
  }

  /**
   * Delete a comment (soft delete)
   */
  async deleteComment(commentId: string, userId?: string): Promise<ServiceResult> {
    return deleteEventComment(commentId, userId);
  }

  /**
   * Get replies to a comment
   */
  async getCommentReplies(commentId: string, limit: number = 20): Promise<any[]> {
    return getCommentReplies(commentId, limit);
  }

  // ==================== EVENT MANAGEMENT ====================

  /**
   * Soft delete an event
   */
  async deleteEvent(eventId: string, reason?: string): Promise<boolean> {
    return deleteEvent(eventId, reason);
  }

  /**
   * Update event content (title, description, metadata)
   */
  async updateEvent(
    eventId: string,
    updates: {
      title?: string;
      description?: string;
      visibility?: TimelineVisibility;
      metadata?: Record<string, unknown>;
    }
  ): Promise<ServiceResult> {
    return updateEvent(eventId, updates);
  }

  /**
   * Update event visibility (owner only) and cascade effect handled by queries
   */
  async updateEventVisibility(
    eventId: string,
    visibility: TimelineVisibility
  ): Promise<ServiceResult> {
    return updateEventVisibility(eventId, visibility);
  }
}

// Export singleton instance
export const timelineService = new TimelineService();
export default timelineService;
