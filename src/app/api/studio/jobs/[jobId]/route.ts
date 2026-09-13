/**
 * GET /api/studio/jobs/[jobId]?medium=video — is the render finished?
 *
 * Stateless on purpose: there is no job table. The poll re-asks the PROVIDER
 * with the same user's key, so a user can only ever see jobs their own key
 * created, and a job cannot outlive the key that made it.
 *
 * On the first poll that reports ready, the bytes are copied into storage and
 * a stable public URL is returned — provider links expire.
 */

import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { createRateLimitResponse, rateLimitStudioPoll } from '@/lib/rate-limit';
import { apiBadRequest, apiError, apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { resolveMediaKey } from '@/services/studio/access';
import { pollJob } from '@/services/studio/media-jobs';
import { persistStudioMedia } from '@/services/studio/persist';
import { logger } from '@/utils/logger';

const querySchema = z.object({ medium: z.enum(['video', 'music']) });

export const GET = withAuth(
  async (request: AuthenticatedRequest, context: { params: Promise<{ jobId: string }> }) => {
    const { user, supabase } = request;
    try {
      const rl = await rateLimitStudioPoll(user.id);
      if (!rl.success) {
        return createRateLimitResponse(rl) as NextResponse;
      }

      const { jobId } = await context.params;
      if (!jobId) {
        return apiBadRequest('Missing job id');
      }

      const url = new URL((request as NextRequest).url);
      const parsed = querySchema.safeParse({ medium: url.searchParams.get('medium') });
      if (!parsed.success) {
        return apiBadRequest('Invalid request', parsed.error.flatten());
      }
      const { medium } = parsed.data;

      const key = await resolveMediaKey(supabase, user.id, medium);
      if (!key) {
        return apiError(
          'The key that started this render is no longer available.',
          'NO_STUDIO_KEY',
          400
        ) as NextResponse;
      }

      const result = await pollJob(
        {
          apiKey: key.apiKey,
          baseUrl: key.baseUrl,
          model: key.model,
          api: key.api,
          providerId: key.providerId,
          medium,
        },
        jobId
      );

      if (result.state === 'pending') {
        return apiSuccess({ state: 'pending' }) as NextResponse;
      }
      if (result.state === 'failed') {
        return apiSuccess({ state: 'failed', error: result.error }) as NextResponse;
      }

      const stored = await persistStudioMedia(user.id, result.media);
      if (!stored.ok) {
        return apiSuccess({ state: 'failed', error: stored.error }) as NextResponse;
      }
      return apiSuccess({
        state: 'ready',
        url: stored.url,
        mimeType: result.media.mimeType,
      }) as NextResponse;
    } catch (error) {
      logger.error('studio/jobs poll failed', error, 'StudioAPI');
      return apiInternalError('Could not check on that render. Please try again.');
    }
  }
);
