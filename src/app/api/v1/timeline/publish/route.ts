/**
 * POST /api/v1/timeline/publish — the async publish bus inbound endpoint.
 *
 * External clients (Loki) publish a publish-worthy build event onto a
 * project's OrangeCat wall. Authenticated via the v1 auth path (OIDC "Login with
 * OrangeCat" access token, or an `ock_` integration key) and gated to the
 * `timeline.write` scope. Idempotent + reconcilable — see externalPublish.ts.
 *
 * Part of the platform's async publish + read-only surfacing slice
 * (docs/architecture/PLATFORM_AND_COLLABORATION.md). This is the OC ingest half;
 * the Loki promote/emit half lives in the Loki repo.
 */
import { NextRequest } from 'next/server';
import { resolveRequestAuth, hasScope } from '@/lib/api/resolveRequestAuth';
import { apiCreated, apiSuccess, apiError, apiRateLimited } from '@/lib/api/standardResponse';
import {
  rateLimitIntegrationKeyWrite,
  rateLimitWriteAsync,
  retryAfterSeconds,
} from '@/lib/rate-limit';
import { externalPublishSchema, isAllowedSourceUrl } from '@/config/external-publish';
import { ingestExternalEvent } from '@/services/timeline/externalPublish';
import { logger } from '@/utils/logger';

const REQUIRED_SCOPE = 'timeline.write';

export async function POST(request: NextRequest) {
  const auth = await resolveRequestAuth(request);
  if (!auth) {
    return apiError('Authentication required', 'UNAUTHORIZED', 401);
  }
  if (!hasScope(auth.scopes, REQUIRED_SCOPE)) {
    return apiError(`Missing required scope: ${REQUIRED_SCOPE}`, 'FORBIDDEN', 403);
  }
  // The wall row is owned by a user (timeline_events.actor_id = user id). Every
  // v1 auth source carries a user id; bail if somehow absent rather than insert
  // an orphaned row.
  if (!auth.userId) {
    return apiError('Authenticated identity has no user id', 'UNAUTHORIZED', 401);
  }

  // Same bucket split as entityPostHandler: per-key for integration keys so
  // one buggy key can't starve the user's other keys; per-user otherwise.
  const rl =
    auth.source === 'integration_key' && auth.integrationKeyId
      ? await rateLimitIntegrationKeyWrite(auth.integrationKeyId)
      : await rateLimitWriteAsync(auth.userId);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 'BAD_REQUEST', 400);
  }

  const parsed = externalPublishSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Validation failed', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  // Defence-in-depth: a deep-link, if present, must point back at the source's
  // own origin — never an arbitrary host surfaced on a user's wall.
  if (parsed.data.url && !isAllowedSourceUrl(parsed.data.source, parsed.data.url)) {
    return apiError(
      `url must be on an allowed origin for source "${parsed.data.source}"`,
      'VALIDATION_ERROR',
      422
    );
  }

  const result = await ingestExternalEvent(parsed.data, auth.userId);
  if (!result.ok) {
    switch (result.reason) {
      case 'subject_not_found':
        return apiError(result.message, 'NOT_FOUND', 404);
      case 'forbidden':
        return apiError(result.message, 'FORBIDDEN', 403);
      default:
        return apiError('Failed to publish event', 'INTERNAL_ERROR', 500);
    }
  }

  logger.info(
    'External event published',
    {
      source: parsed.data.source,
      externalId: parsed.data.external_id,
      status: result.status,
      eventId: result.eventId,
      subjectId: parsed.data.subject_id,
    },
    'ExternalPublish'
  );

  const payload = { id: result.eventId, status: result.status };
  // 201 on first publish, 200 on a reconciling re-publish.
  return result.status === 'created' ? apiCreated(payload) : apiSuccess(payload);
}
