/**
 * GET /api/user/api-keys/elsewhere
 *
 * Provider keys this person holds on Loki and has not added here, by name
 * only (services/ai/keys-elsewhere). Empty when Loki is not linked, has no
 * keys, or cannot be reached: a suggestion is never worth an error.
 */
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess, handleApiError } from '@/lib/api/standardResponse';
import { getUserActorId } from '@/domain/actors';
import { createApiKeyService } from '@/services/ai/api-key-service';
import { keysOnLokiNotHere } from '@/services/ai/keys-elsewhere';
import { fetchLokiActorStatus } from '@/services/loki/actor-status';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const actorId = await getUserActorId(supabase, user.id);
    const status = actorId ? await fetchLokiActorStatus(actorId) : null;
    if (!status?.linked || status.modelKeys.length === 0) {
      return apiSuccess({ loki: [] });
    }
    const keys = await createApiKeyService(supabase).getKeys(user.id);
    return apiSuccess({
      loki: keysOnLokiNotHere(
        status.modelKeys,
        keys.map(k => k.provider)
      ),
    });
  } catch (error) {
    return handleApiError(error);
  }
});
