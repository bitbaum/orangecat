/**
 * POST /api/chat/feedback — a thumb under a Cat answer.
 *
 * Body `{ conversationId, messageId, verdict, reason?, text? }` as chatkit's
 * AnswerFeedback gives it. Signed in, rate limited as a write, stored with
 * the person's conversation (src/services/cat/chat-feedback.ts).
 */

import { compose } from '@/lib/api/compose';
import { withRequestId } from '@/lib/api/withRequestId';
import { withRateLimit } from '@/lib/api/withRateLimit';
import { withZodBody } from '@/lib/api/withZod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess, apiNotFound, handleApiError } from '@/lib/api/standardResponse';
import {
  chatFeedbackSchema,
  recordChatFeedback,
  type ChatFeedbackInput,
} from '@/services/cat/chat-feedback';

export const dynamic = 'force-dynamic';

export const POST = compose(
  withRequestId(),
  withRateLimit('write'),
  withZodBody(chatFeedbackSchema)
)(
  withAuth(async (req: AuthenticatedRequest, ctx) => {
    try {
      const result = await recordChatFeedback(
        req.supabase,
        req.user.id,
        ctx.body as ChatFeedbackInput
      );
      if (!result.ok) {
        return apiNotFound('Conversation not found');
      }
      return apiSuccess({ messageId: result.messageId });
    } catch (error) {
      return handleApiError(error);
    }
  })
);
