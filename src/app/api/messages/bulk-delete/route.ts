import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiValidationError,
  apiForbidden,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { logger } from '@/utils/logger';
import { z } from 'zod';
import { DATABASE_TABLES } from '@/config/database-tables';
import { markAttachmentsRemoved } from '@/features/messaging/server/attachments';
import { createAdminClient } from '@/lib/supabase/admin';

const bulkDeleteSchema = z.object({
  conversationId: z.string().min(1),
  ids: z.array(z.string().min(1)).min(1),
});

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { user, supabase } = req;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      const retryAfter = retryAfterSeconds(rl);
      return apiRateLimited('Too many requests. Please slow down.', retryAfter);
    }

    const body = await req.json().catch(() => ({}));
    const validation = bulkDeleteSchema.safeParse(body);

    if (!validation.success) {
      return apiValidationError('Invalid request', {
        fields: validation.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const { conversationId, ids } = validation.data;

    // Verify user is participant
    const { data: participant } = await supabase
      .from(DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!participant) {
      return apiForbidden('Access denied');
    }

    // Soft delete messages (only messages sent by current user)
    // PURE RLS: relies on 'Message senders can update their messages' policy
    const { error: updErr, data } = await supabase
      .from(DATABASE_TABLES.MESSAGES)
      .update({ is_deleted: true })
      .in('id', ids)
      .eq('conversation_id', conversationId)
      .eq('sender_id', user.id)
      .select('id');

    if (updErr) {
      logger.error(
        'Failed to delete messages',
        { error: updErr, conversationId, userId: user.id, messageIds: ids },
        'Messages'
      );
      return handleApiError(updErr);
    }

    // The files of a deleted message are no longer anybody's to read; the
    // daily cleanup takes them out of storage.
    await markAttachmentsRemoved(
      createAdminClient(),
      (data ?? []).map(row => row.id as string)
    );

    return apiSuccess({ deleted: data?.length || 0 });
  } catch (error) {
    logger.error('Bulk delete messages error', { error, userId: req.user.id }, 'Messages');
    return handleApiError(error);
  }
});
