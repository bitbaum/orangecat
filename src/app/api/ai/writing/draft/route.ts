/**
 * POST /api/ai/writing/draft — AI draft of a post or a full article, in the
 * user's voice and grounded in their context. Thin wrapper over the
 * writing-engine; auth + write-tier rate limit.
 */

import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { createRateLimitResponse, rateLimitWriteAsync } from '@/lib/rate-limit';
import { apiBadRequest, apiError, apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { draftArticle, draftPost, draftReply } from '@/services/cat/writing-engine';
import { logger } from '@/utils/logger';

const bodySchema = z.object({
  mode: z.enum(['post', 'article', 'reply']),
  topic: z.string().trim().max(300).optional(),
  focus: z.string().trim().max(200).optional(),
  // Reply mode: the post being answered + how to engage it.
  parentText: z.string().trim().max(4000).optional(),
  parentAuthor: z.string().trim().max(120).optional(),
  intent: z.enum(['thoughtful', 'add', 'question', 'agree', 'pushback']).optional(),
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return createRateLimitResponse(rl) as NextResponse;
    }

    const parsed = bodySchema.safeParse(await (request as NextRequest).json().catch(() => ({})));
    if (!parsed.success) {
      return apiBadRequest('Invalid request', parsed.error.flatten());
    }

    const { mode, topic, focus, parentText, parentAuthor, intent } = parsed.data;

    if (mode === 'reply' && !parentText) {
      return apiBadRequest('Nothing to reply to — the post text is missing.');
    }

    let draft;
    if (mode === 'article') {
      draft = await draftArticle(supabase, user.id, { topic, focus });
    } else if (mode === 'reply') {
      draft = await draftReply(supabase, user.id, {
        parentText: parentText ?? '',
        parentAuthor,
        intent,
      });
    } else {
      draft = await draftPost(supabase, user.id, { topic, focus });
    }

    if (!draft) {
      return apiError(
        'Writing assistance is temporarily unavailable. Try again, or continue writing in the editor.',
        'AI_UNAVAILABLE',
        503
      ) as NextResponse;
    }
    return apiSuccess({ mode, draft }) as NextResponse;
  } catch (error) {
    logger.error('writing/draft failed', error, 'WritingAPI');
    return apiInternalError('Could not draft that right now. Please try again.');
  }
});
