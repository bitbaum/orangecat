/**
 * Notification Service
 *
 * Server-side service for creating and managing notifications.
 * Used by task management and other backend features.
 *
 * Created: 2026-02-05
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { InAppNotificationType } from '@/config/notification-types';

// The one list (config/notification-types.ts) — the database CHECK mirrors it.
type NotificationType = InAppNotificationType;

interface CreateNotificationOptions {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  actionUrl?: string | null;
  sourceActorId?: string | null;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  metadata?: Record<string, unknown>;
}

interface BroadcastNotificationOptions {
  excludeUserId?: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  actionUrl?: string | null;
  sourceActorId?: string | null;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  metadata?: Record<string, unknown>;
}

interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
}

interface BroadcastResult {
  success: boolean;
  count?: number;
  error?: string;
}

/**
 * Build a notifications row in the live schema.
 *
 * The table stores: user_id, type, message (NOT NULL), action_url, is_read, metadata.
 * There is no title / source_* column — those are folded into metadata so the
 * UI can still surface them (title via metadata.title). message falls back to
 * title to satisfy the NOT NULL constraint when a caller passes none.
 */
function buildNotificationRow(
  userId: string,
  options: Omit<CreateNotificationOptions, 'recipientUserId'>
) {
  return {
    user_id: userId,
    type: options.type,
    message: options.message || options.title,
    action_url: options.actionUrl || null,
    is_read: false,
    metadata: {
      ...(options.metadata || {}),
      title: options.title,
      source_actor_id: options.sourceActorId || null,
      source_entity_type: options.sourceEntityType || null,
      source_entity_id: options.sourceEntityId || null,
    },
  };
}

/**
 * Notification Service for server-side notification management
 */
export class NotificationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a notification for a single user
   */
  async createNotification(options: CreateNotificationOptions): Promise<NotificationResult> {
    try {
      const { data, error } = await this.supabase
        .from(DATABASE_TABLES.NOTIFICATIONS)
        .insert(buildNotificationRow(options.recipientUserId, options))
        .select('id')
        .single();

      if (error) {
        logger.error('Failed to create notification', { error, options }, 'NotificationService');
        return { success: false, error: error.message };
      }

      return { success: true, notificationId: data.id };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error(
        'Exception creating notification',
        { error: err, options },
        'NotificationService'
      );
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Create notifications for all users (broadcast)
   * Useful for task requests to "anyone"
   *
   * @param options - Broadcast options including optional user to exclude (usually the sender)
   */
  async createBroadcastNotification(
    options: BroadcastNotificationOptions
  ): Promise<BroadcastResult> {
    try {
      // Get all user IDs except the excluded one
      // Note: In production, filter by team membership or staff status
      let query = this.supabase.from(DATABASE_TABLES.PROFILES).select('id');

      if (options.excludeUserId) {
        query = query.neq('id', options.excludeUserId);
      }

      const { data: users, error: usersError } = await query;

      if (usersError) {
        logger.error(
          'Failed to fetch users for broadcast',
          { error: usersError },
          'NotificationService'
        );
        return { success: false, error: usersError.message };
      }

      if (!users || users.length === 0) {
        return { success: true, count: 0 };
      }

      // Batch insert notifications
      const notifications = users.map(user => buildNotificationRow(user.id, options));

      const { error: insertError } = await this.supabase
        .from(DATABASE_TABLES.NOTIFICATIONS)
        .insert(notifications);

      if (insertError) {
        logger.error(
          'Failed to create broadcast notifications',
          { error: insertError },
          'NotificationService'
        );
        return { success: false, error: insertError.message };
      }

      return { success: true, count: notifications.length };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error(
        'Exception creating broadcast notification',
        { error: err, options },
        'NotificationService'
      );
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from(DATABASE_TABLES.NOTIFICATIONS)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        logger.error('Failed to get unread count', { error, userId }, 'NotificationService');
        return 0;
      }

      return count || 0;
    } catch (err) {
      logger.error('Exception getting unread count', { error: err, userId }, 'NotificationService');
      return 0;
    }
  }

  /**
   * Mark notification(s) as read
   */
  async markAsRead(userId: string, notificationIds?: string[]): Promise<boolean> {
    try {
      let query = this.supabase
        .from(DATABASE_TABLES.NOTIFICATIONS)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (notificationIds && notificationIds.length > 0) {
        query = query.in('id', notificationIds);
      }

      const { error } = await query;

      if (error) {
        logger.error(
          'Failed to mark as read',
          { error, userId, notificationIds },
          'NotificationService'
        );
        return false;
      }

      return true;
    } catch (err) {
      logger.error(
        'Exception marking as read',
        { error: err, userId, notificationIds },
        'NotificationService'
      );
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    return this.markAsRead(userId);
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    }
  ): Promise<{ notifications: Notification[]; total: number }> {
    try {
      const { limit = 20, offset = 0, unreadOnly = false } = options || {};

      let query = this.supabase
        .from(DATABASE_TABLES.NOTIFICATIONS)
        .select('id, user_id, type, message, action_url, is_read, read_at, created_at, metadata', {
          count: 'exact',
        })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch notifications', { error, userId }, 'NotificationService');
        return { notifications: [], total: 0 };
      }

      return {
        notifications: data || [],
        total: count || 0,
      };
    } catch (err) {
      logger.error(
        'Exception fetching notifications',
        { error: err, userId },
        'NotificationService'
      );
      return { notifications: [], total: 0 };
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(DATABASE_TABLES.NOTIFICATIONS)
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        logger.error(
          'Failed to delete notification',
          { error, userId, notificationId },
          'NotificationService'
        );
        return false;
      }

      return true;
    } catch (err) {
      logger.error(
        'Exception deleting notification',
        { error: err, userId, notificationId },
        'NotificationService'
      );
      return false;
    }
  }
}

// Re-export notification interface for convenience.
// Matches the live `notifications` table: title and any source_* ids live
// inside metadata (see buildNotificationRow), not as top-level columns.
interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  message: string;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export type { Notification };
