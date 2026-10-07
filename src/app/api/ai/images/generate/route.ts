/**
 * AI image generation — BYOK-ONLY.
 *
 * GET  — capability probe: does this user have a valid key from an
 *        image-capable provider (IMAGE_PROVIDER_RUNTIME)?
 * POST — generate an image from a prompt with the USER'S OWN key, persist it
 *        to storage, return a stable public URL.
 *
 * The platform free pool (Groq/OpenRouter text models) is NEVER used here and
 * checkPlatformUsage/incrementPlatformUsage are deliberately absent: image
 * generation only ever spends the user's own credits, so it cannot drain the
 * platform quota. Only the generic write rate limit applies.
 */

import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { createRateLimitResponse, rateLimitWriteAsync } from '@/lib/rate-limit';
import { apiBadRequest, apiError, apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { createApiKeyService } from '@/services/ai/api-key-service';
import { IMAGE_PROVIDER_RUNTIME } from '@/config/ai-provider-runtime';
import { generateAndStoreImage } from '@/services/images/generate-and-store';
import { IMAGE_PROMPT_LIMITS } from '@/config/images';
import { logger } from '@/utils/logger';

const bodySchema = z.object({
  prompt: z.string().trim().min(IMAGE_PROMPT_LIMITS.min).max(IMAGE_PROMPT_LIMITS.max),
});

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const keys = await createApiKeyService(supabase).getKeys(user.id);
    const capable = keys.find(k => k.is_valid && k.provider in IMAGE_PROVIDER_RUNTIME);
    return apiSuccess({
      canGenerate: Boolean(capable),
      provider: capable?.provider ?? null,
    }) as NextResponse;
  } catch (error) {
    logger.error('images/generate capability probe failed', error, 'ImagesAPI');
    return apiInternalError('Could not check image generation availability.');
  }
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
    const { prompt } = parsed.data;

    const result = await generateAndStoreImage(supabase, user.id, prompt);
    if (!result.ok) {
      // No provider names in the NO_IMAGE_KEY message — the client derives
      // them from IMAGE_PROVIDER_RUNTIME so the list can't drift.
      if (result.code === 'NO_IMAGE_KEY') {
        return apiError(result.error, 'NO_IMAGE_KEY', 400);
      }
      if (result.code === 'UPSTREAM') {
        return apiError(result.error, 'UPSTREAM_ERROR', 502);
      }
      return apiInternalError(result.error);
    }
    return apiSuccess({
      url: result.url,
      provider: result.provider,
      model: result.model,
    }) as NextResponse;
  } catch (error) {
    logger.error('images/generate failed', error, 'ImagesAPI');
    return apiInternalError('Could not generate an image right now. Please try again.');
  }
});
