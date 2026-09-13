/**
 * POST /api/studio/generate — make something from a prompt.
 *
 * BYOK for video, music and images; writing runs on the platform's own text
 * models like every other writing surface here. The platform free pool must
 * never pay for a render, which is why only the writing branch reaches it.
 *
 * Video and music answer with a job id rather than a file: a render takes
 * minutes, and holding the request open that long fails behind any proxy.
 */

import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { createRateLimitResponse, rateLimitWriteAsync } from '@/lib/rate-limit';
import { apiBadRequest, apiError, apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { STUDIO_MEDIUMS, STUDIO_PROMPT_LIMITS } from '@/config/studio';
import { startStudioGeneration } from '@/services/studio/generate';
import { logger } from '@/utils/logger';

const bodySchema = z.object({
  medium: z.enum(STUDIO_MEDIUMS),
  prompt: z.string().trim().min(STUDIO_PROMPT_LIMITS.min).max(STUDIO_PROMPT_LIMITS.max),
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
    const { medium, prompt } = parsed.data;

    const outcome = await startStudioGeneration(supabase, user.id, medium, prompt);

    switch (outcome.kind) {
      case 'needs_key':
        return apiError(outcome.message, 'NO_STUDIO_KEY', 400) as NextResponse;
      case 'error':
        return apiError(outcome.message, 'UPSTREAM_ERROR', 502) as NextResponse;
      default:
        return apiSuccess({ medium, ...outcome }) as NextResponse;
    }
  } catch (error) {
    logger.error('studio/generate failed', error, 'StudioAPI');
    return apiInternalError('Could not start that right now. Please try again.');
  }
});
