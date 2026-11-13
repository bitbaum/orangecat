/**
 * PUT /api/messages/reactions — put the caller's emoji on a message, or take
 * it off (`emoji: null`). One per person per message.
 *
 * Thin HTTP layer: who may react, and what a reaction does, live in
 * @/features/messaging/server/extras.
 */

import { z } from 'zod';
import { QUICK_REACTIONS } from '@bitbaum/chatkit';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiNotFound,
  apiForbidden,
  apiValidationError,
  apiRateLimited,
  apiInternalError,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { setReaction } from '@/features/messaging/server/extras';
import { logger } from '@/utils/logger';

const schema = z.object({
  messageId: z.string().guid(),
  // The Messenger offers exactly these; anything else is not a reaction here.
  emoji: z
    .string()
    .refine(value => QUICK_REACTIONS.includes(value), 'Not a reaction')
    .nullable(),
});

export const PUT = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { user } = req;
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiValidationError('Invalid reaction');
    }
    const result = await setReaction(
      createAdminClient(),
      user.id,
      parsed.data.messageId,
      parsed.data.emoji
    );
    if (!result.ok) {
      return result.code === 'not_found'
        ? apiNotFound('Message not found')
        : result.code === 'forbidden'
          ? apiForbidden('Not a participant in this conversation')
          : apiInternalError('That reaction was not saved. Try again.');
    }
    return apiSuccess({ saved: true });
  } catch (error) {
    logger.error('Reaction PUT error', { error, userId: req.user.id }, 'Messages');
    return handleApiError(error);
  }
});
