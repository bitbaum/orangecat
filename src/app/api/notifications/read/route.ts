import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  handleApiError,
  apiRateLimited,
  apiBadRequest,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import { z } from 'zod';

const markReadSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ id: z.string().guid('Invalid notification ID') }),
  z.object({ ids: z.array(z.string().guid('Invalid notification ID')).min(1).max(100) }),
]);

/**
 * POST /api/notifications/read
 *
 * Mark notifications as read.
 *
 * Body:
 * - id: single notification ID
 * - ids: array of notification IDs
 * - all: boolean to mark all as read
 *
 * Uses authenticated user session (RLS) and canonical column names:
 * - user_id
 * - is_read
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { user, supabase } = req;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      const retryAfter = retryAfterSeconds(rl);
      return apiRateLimited('Too many requests. Please slow down.', retryAfter);
    }

    const body = await req.json();

    const parsed = markReadSchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid request body');
    }
    const data = parsed.data;

    const now = new Date().toISOString();

    if ('all' in data && data.all) {
      const { error, count } = await supabase
        .from(DATABASE_TABLES.NOTIFICATIONS)
        .update({ is_read: true, read_at: now })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        throw error;
      }
      return apiSuccess({ marked: count || 0 });
    }

    if ('id' in data) {
      const { error, count } = await supabase
        .from(DATABASE_TABLES.NOTIFICATIONS)
        .update({ is_read: true, read_at: now })
        .eq('id', data.id)
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        throw error;
      }
      return apiSuccess({ marked: count || 0 });
    }

    if ('ids' in data) {
      const { error, count } = await supabase
        .from(DATABASE_TABLES.NOTIFICATIONS)
        .update({ is_read: true, read_at: now })
        .in('id', data.ids)
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        throw error;
      }
      return apiSuccess({ marked: count || 0 });
    }

    // Unreachable: Zod union above covers all valid shapes
    return apiBadRequest('Must provide id, ids, or all parameter');
  } catch (error) {
    logger.error('Mark notifications read error', { error }, 'Notifications');
    return handleApiError(error);
  }
});
