import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiForbidden,
  apiRateLimited,
  apiServiceUnavailable,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { createFleetCrownHandoff } from '@/services/fleetcrown/handoff';

/**
 * POST /api/integrations/fleetcrown/build-intents
 *
 * A thin HTTP skin over createFleetCrownHandoff — the same service Cat's
 * `send_to_fleetcrown` action uses, so the two cannot disagree about who may
 * hand an entity over.
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const rl = await rateLimitWriteAsync(request.user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }

  const body = (await request.json()) as {
    entity_type?: string;
    entity_id?: string;
    source_path?: string;
  };

  const result = await createFleetCrownHandoff({
    supabase: request.supabase,
    userId: request.user.id,
    entityType: String(body.entity_type ?? ''),
    entityId: String(body.entity_id ?? ''),
    sourcePath: String(body.source_path ?? ''),
  });

  if (!result.ok) {
    switch (result.code) {
      case 'forbidden':
        return apiForbidden(result.message);
      case 'unconfigured':
        // FLEETCROWN_BUILD_INTENT_SECRET not set on this deploy — the handoff is
        // unavailable, not a server fault. 503 so the CTA can fall back to the
        // plain FleetCrown link instead of surfacing a generic 500.
        return apiServiceUnavailable(result.message);
      default:
        return apiBadRequest(result.message);
    }
  }

  return apiSuccess({ url: result.url, expires_in_seconds: result.expiresInSeconds });
});
