/**
 * POST /api/studio/revise — say what's wrong, get the next version.
 *
 * Two shapes behind one endpoint, because to the person using it there is only
 * one idea: "change this".
 *
 * - Video, music, images: the NOTE rewrites the PROMPT, because a generation
 *   model cannot be given a critique of something it no longer has. The caller
 *   then sends the new prompt to /generate.
 * - Writing: the note revises the TEXT directly, through the same engine that
 *   already edits articles in the author's own voice.
 */

import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { createRateLimitResponse, rateLimitWriteAsync } from '@/lib/rate-limit';
import { apiBadRequest, apiError, apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { STUDIO_MEDIUMS, STUDIO_PROMPT_LIMITS, STUDIO_REVISION_LIMITS } from '@/config/studio';
import { appendNoteFallback, revisePrompt } from '@/services/studio/revise-prompt';
import { reviseText } from '@/services/cat/writing-revise';
import { logger } from '@/utils/logger';

const bodySchema = z.object({
  medium: z.enum(STUDIO_MEDIUMS),
  note: z.string().trim().min(STUDIO_REVISION_LIMITS.min).max(STUDIO_REVISION_LIMITS.max),
  /** The prompt behind the current version (video / music / image). */
  previousPrompt: z.string().trim().max(STUDIO_PROMPT_LIMITS.max).optional(),
  /** The current text (writing only). */
  text: z.string().trim().max(100_000).optional(),
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
    const { medium, note, previousPrompt, text } = parsed.data;

    if (medium === 'writing') {
      if (!text) {
        return apiBadRequest('There is nothing to revise yet.');
      }
      const revised = await reviseText(supabase, user.id, {
        action: 'improve',
        text,
        instruction: note,
        kind: 'article',
      });
      if (!revised) {
        return apiError(
          'The writer is busy right now. Try again in a moment.',
          'AI_UNAVAILABLE',
          503
        ) as NextResponse;
      }
      return apiSuccess({ medium, text: revised }) as NextResponse;
    }

    if (!previousPrompt) {
      return apiBadRequest('There is nothing to revise yet.');
    }

    // A failed rewrite still has to leave the user able to iterate, so fall
    // back to appending the note rather than refusing the turn.
    const rewritten = await revisePrompt({ medium, previousPrompt, note });
    return apiSuccess({
      medium,
      prompt: rewritten ?? appendNoteFallback(previousPrompt, note),
      rewritten: Boolean(rewritten),
    }) as NextResponse;
  } catch (error) {
    logger.error('studio/revise failed', error, 'StudioAPI');
    return apiInternalError('Could not revise that right now. Please try again.');
  }
});
