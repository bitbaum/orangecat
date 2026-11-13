import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiSuccess, handleApiError, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/constants/pagination';
import { isNotificationFilterCategory, notificationTypesIn } from '@/config/notification-types';

/**
 * GET /api/notifications
 *
 * Fetch user's notifications with pagination.
 * Query params: limit (default 20, max 100), offset (default 0),
 * filter ('all' | 'unread' | a category: 'payments' | 'social' | 'messages' | a single type)
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { user } = req;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE)),
      MAX_PAGE_SIZE
    );
    const offset = parseInt(searchParams.get('offset') || '0');
    const filter = searchParams.get('filter') || 'all';

    const admin = createAdminClient();
    // Live schema: notifications uses user_id / is_read / metadata (title and
    // any source actor/entity ids live inside metadata). There is no title,
    // read, or source_* column — see migration *_align_notifications_to_live_schema.
    let query = admin
      .from(DATABASE_TABLES.NOTIFICATIONS)
      .select(`id, type, message, action_url, is_read, read_at, created_at, metadata`, {
        count: 'exact',
      })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (filter === 'unread') {
      query = query.eq('is_read', false);
    } else if (isNotificationFilterCategory(filter)) {
      query = query.in('type', notificationTypesIn(filter));
    } else if (filter !== 'all') {
      query = query.eq('type', filter);
    }

    const { data: notifications, error, count } = await query;
    if (error) {
      logger.error('Failed to fetch notifications', { error, userId: user.id }, 'Notifications');
      throw error;
    }

    return apiSuccess({ notifications: notifications || [], total: count || 0, limit, offset });
  } catch (error) {
    logger.error('Notifications API error', { error }, 'Notifications');
    return handleApiError(error);
  }
});

/**
 * DELETE /api/notifications
 *
 * Clear notifications. Query params:
 * - id: specific notification ID to delete
 * - clear: 'read' | 'all' to bulk-clear
 */
export const DELETE = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { user } = req;
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const { searchParams } = new URL(req.url);
    const notificationId = searchParams.get('id');
    const clearType = searchParams.get('clear');

    const admin = createAdminClient();
    let deleteQuery = admin.from(DATABASE_TABLES.NOTIFICATIONS).delete().eq('user_id', user.id);

    if (notificationId) {
      deleteQuery = deleteQuery.eq('id', notificationId);
    } else if (clearType === 'read') {
      deleteQuery = deleteQuery.eq('is_read', true);
    } else if (clearType !== 'all') {
      return apiSuccess({ deleted: 0 });
    }

    const { error, count } = await deleteQuery;
    if (error) {
      throw error;
    }

    return apiSuccess({ deleted: notificationId ? 1 : count || 0 });
  } catch (error) {
    logger.error('Delete notifications error', { error }, 'Notifications');
    return handleApiError(error);
  }
});
