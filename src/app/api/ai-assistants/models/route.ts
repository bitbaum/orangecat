/**
 * GET /api/ai-assistants/models — the models this person can choose for a
 * bot's chat: their own key's list, or "the shared pool picks".
 *
 * Calls no model and spends nothing: it reads the provider's list of names
 * for the person's own key (services/ai/own-models.ts).
 */
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { createApiKeyService } from '@/services/ai/api-key-service';
import { pickOwnKey } from '@/services/ai/own-key';
import { listOwnModels } from '@/services/ai/own-models';
import { listLokiModels, sharedLokiOwnKeys } from '@/services/loki/shared-keys';
import { logger } from '@/utils/logger';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const keys = await createApiKeyService(request.supabase).listDecryptedKeysOrdered(
      request.user.id
    );
    const own =
      pickOwnKey(keys) ??
      pickOwnKey(await sharedLokiOwnKeys(request.supabase, request.user.id).catch(() => []));
    const choices = await listOwnModels(own, fetch, listLokiModels);
    return apiSuccess(choices, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    logger.error('model choices could not be read', error, 'BotModels');
    return apiInternalError('The list of models could not be read.');
  }
});
