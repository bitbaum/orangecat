/**
 * /api/user/api-keys/elsewhere
 *
 * GET   Provider keys this person holds on Loki and has not added here, by
 *       name only (services/ai/keys-elsewhere). Empty when Loki is not linked,
 *       has no keys, or cannot be reached: a suggestion is never worth an error.
 * POST  The signed-in person switches one of those keys on or off for their
 *       bots here. The key stays on Loki; nothing secret passes through this
 *       route in either direction (services/loki/shared-keys).
 */
import { z } from 'zod';

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiError, apiRateLimited, apiSuccess, handleApiError } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getUserActorId } from '@/domain/actors';
import { createApiKeyService } from '@/services/ai/api-key-service';
import { keysLokiCanAnswerOn, keysOnLokiNotHere } from '@/services/ai/keys-elsewhere';
import { fetchLokiActorStatus } from '@/services/loki/actor-status';
import { fetchLokiKeys, shareLokiKey } from '@/services/loki/shared-keys';

const NO_STORE = { headers: { 'Cache-Control': 'private, no-store' } };

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const actorId = await getUserActorId(supabase, user.id);
    if (!actorId) {
      return apiSuccess({ loki: [] }, NO_STORE);
    }
    const here = (await createApiKeyService(supabase).getKeys(user.id)).map(k => k.provider);
    const held = await fetchLokiKeys(actorId);
    if (held) {
      return apiSuccess({ loki: keysLokiCanAnswerOn(held, here) }, NO_STORE);
    }
    // Loki cannot answer on a key yet, or did not say: the names alone.
    const status = await fetchLokiActorStatus(actorId);
    if (!status?.linked || status.modelKeys.length === 0) {
      return apiSuccess({ loki: [] }, NO_STORE);
    }
    return apiSuccess({ loki: keysOnLokiNotHere(status.modelKeys, here) }, NO_STORE);
  } catch (error) {
    return handleApiError(error);
  }
});

const Switch = z.object({ provider: z.string().min(1).max(40), on: z.boolean() }).strict();

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const parsed = Switch.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError('Say which key, and whether to use it.', 'VALIDATION_ERROR', 400);
    }
    const actorId = await getUserActorId(supabase, user.id);
    if (!actorId) {
      return apiError('Your account is not linked to Loki yet.', 'NOT_LINKED', 409);
    }
    const done = await shareLokiKey(actorId, parsed.data.provider, parsed.data.on);
    if (!done.ok) {
      return apiError(done.message, 'LOKI_REFUSED', 502);
    }
    return apiSuccess({ provider: parsed.data.provider, shared: done.shared }, NO_STORE);
  } catch (error) {
    return handleApiError(error);
  }
});
