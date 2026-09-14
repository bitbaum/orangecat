/**
 * User API Keys Management
 *
 * GET - List user's API keys
 * POST - Add a new API key
 *
 * Last Modified: 2026-09-14
 * Last Modified Summary: A key may name its own endpoint (schema moved to lib/validation/byok)
 */

import { createApiKeyService, hasActiveByok } from '@/services/ai/api-key-service';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { z } from 'zod';
import { addKeySchema } from '@/lib/validation/byok';
import { PLATFORM_CHAIN_ID } from '@/services/ai/key-chain';
import { logger } from '@/utils/logger';
import {
  apiSuccess,
  apiCreated,
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { apiErrorMessage } from '@/lib/api/errorMessage';

const reorderSchema = z.object({
  // Each entry is a key id (uuid) or the literal 'platform' sentinel for the
  // free OrangeCat default's position in the chain.
  order: z
    .array(z.union([z.string().guid(), z.literal(PLATFORM_CHAIN_ID)]))
    .min(1)
    .max(50),
});

/**
 * GET /api/user/api-keys
 * List all API keys for the current user
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const keyService = createApiKeyService(supabase);
    const keys = await keyService.getKeys(user.id);

    // Also get platform usage
    const platformUsage = await keyService.checkPlatformUsage(user.id);

    return apiSuccess({
      keys,
      platformUsage,
      hasByok: hasActiveByok(keys),
    });
  } catch (error) {
    logger.error('Error fetching API keys', error, 'ApiKeysAPI');
    return apiInternalError('Internal server error');
  }
});

/**
 * POST /api/user/api-keys
 * Add a new API key
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      const retryAfter = retryAfterSeconds(rl);
      return apiRateLimited('Too many API key requests. Please slow down.', retryAfter);
    }

    const body = await request.json();
    const result = addKeySchema.safeParse(body);

    if (!result.success) {
      return apiBadRequest('Validation failed', result.error.flatten());
    }

    const { provider, keyName, apiKey, isPrimary, baseUrl, defaultModel } = result.data;

    const keyService = createApiKeyService(supabase);
    const addResult = await keyService.addKey({
      userId: user.id,
      provider,
      keyName,
      apiKey,
      isPrimary,
      baseUrl,
      defaultModel,
    });

    if (!addResult.success) {
      return apiBadRequest(apiErrorMessage(addResult, 'Failed to add API key'));
    }

    return apiCreated(addResult.key);
  } catch (error) {
    logger.error('Error adding API key', error, 'ApiKeysAPI');
    return apiInternalError('Internal server error');
  }
});

/**
 * PATCH /api/user/api-keys
 * Reorder the fallback chain — body: { order: string[] } (key ids, first tried earliest)
 */
export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const body = await request.json();
    const result = reorderSchema.safeParse(body);
    if (!result.success) {
      return apiBadRequest('Validation failed', result.error.flatten());
    }

    const keyService = createApiKeyService(supabase);
    const ok = await keyService.reorderKeys(user.id, result.data.order);
    if (!ok) {
      return apiInternalError('Failed to reorder keys');
    }

    return apiSuccess({ keys: await keyService.getKeys(user.id) });
  } catch (error) {
    logger.error('Error reordering API keys', error, 'ApiKeysAPI');
    return apiInternalError('Internal server error');
  }
});
