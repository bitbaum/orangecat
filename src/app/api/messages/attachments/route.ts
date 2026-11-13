/**
 * Message attachments
 *
 * POST /api/messages/attachments — start an upload: the caller says what the
 *   file is, the policy decides whether it may be sent, and the answer is a
 *   signed URL the browser sends the bytes to. The bytes never pass through
 *   this app.
 * GET  /api/messages/attachments — how much the caller has stored, so the
 *   browser can refuse a file that would not fit before uploading it.
 *
 * Thin HTTP layer: every decision is in features/messaging/server/attachments.
 */

import { z } from 'zod';
import { formatBytes, type AttachmentRefusal } from '@bitbaum/chatkit';
import { MESSAGE_ATTACHMENT_POLICY } from '@/config/message-attachments';
import { startUpload, storedBytesOf } from '@/features/messaging/server/attachments';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiCreated,
  apiForbidden,
  apiRateLimited,
  apiSuccess,
  apiValidationError,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/utils/logger';

const startUploadSchema = z.object({
  conversationId: z.string().guid(),
  name: z.string().min(1).max(300),
  mimeType: z.string().min(1).max(150),
  bytes: z.number().int().positive(),
  width: z.number().int().positive().max(100_000).optional(),
  height: z.number().int().positive().max(100_000).optional(),
  durationMs: z.number().int().nonnegative().max(86_400_000).optional(),
  poster: z.boolean().optional(),
});

/** Why a file was refused, for the person who picked it. */
function refusalMessage(refusal: AttachmentRefusal): string {
  switch (refusal.reason) {
    case 'type':
      return 'This kind of file cannot be sent here.';
    case 'empty':
      return 'This file is empty.';
    case 'size':
      return `This file is too large (max ${formatBytes(refusal.maxBytes)}).`;
    case 'count':
      return `Up to ${refusal.maxPerMessage} files in one message.`;
    case 'quota':
      return `Your storage is full (${formatBytes(refusal.usedBytes)} of ${formatBytes(refusal.quotaBytes)}). Delete older files to send new ones.`;
  }
}

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { user } = req;
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many uploads. Please slow down.', retryAfterSeconds(rl));
    }

    const validation = startUploadSchema.safeParse(await req.json().catch(() => null));
    if (!validation.success) {
      return apiValidationError('Invalid upload request', {
        fields: validation.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const result = await startUpload(createAdminClient(), user.id, validation.data);
    if (!result.ok) {
      return result.code === 'forbidden'
        ? apiForbidden('Not a participant in this conversation')
        : apiValidationError(refusalMessage(result.refusal), { reason: result.refusal.reason });
    }
    return apiCreated({
      attachment: result.attachment,
      upload: result.upload,
      poster: result.poster,
    });
  } catch (error) {
    logger.error('Attachment upload start failed', { error, userId: req.user.id }, 'Messages');
    return handleApiError(error);
  }
});

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const usedBytes = await storedBytesOf(createAdminClient(), req.user.id);
    return apiSuccess(
      { usedBytes, quotaBytes: MESSAGE_ATTACHMENT_POLICY.quotaBytes },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    logger.error('Attachment usage failed', { error, userId: req.user.id }, 'Messages');
    return handleApiError(error);
  }
});
