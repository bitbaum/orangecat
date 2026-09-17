/**
 * Generic Entity POST Handler
 *
 * Provides reusable POST handler for entity creation endpoints.
 * Handles auth, rate limiting, validation, and database insertion.
 *
 * Benefits:
 * - Eliminates duplication across entity creation routes
 * - Consistent error handling
 * - Automatic rate limiting
 * - Type-safe validation
 * - Easy to add new entity types
 *
 * Created: 2025-01-28
 * Last Modified: 2026-01-05
 * Last Modified Summary: Support async transformData with supabase parameter for user preference access
 */

import { fromTable } from '@/lib/supabase/untyped';
import { NextRequest } from 'next/server';
import { z, ZodObject, ZodSchema } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  apiSuccess,
  apiUnauthorized,
  apiInternalError,
  apiForbidden,
  handleApiError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { compose } from '@/lib/api/compose';
import { withZodBody } from '@/lib/api/withZod';
import { withRequestId } from '@/lib/api/withRequestId';
import {
  rateLimitWriteAsync,
  rateLimitIntegrationKeyWrite,
  applyRateLimitHeaders,
  type RateLimitResult,
} from '@/lib/rate-limit';
import { logger } from '@/utils/logger';
import { type EntityType, getEntityMetadata } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { NextResponse } from 'next/server';
import {
  resolveCreationActor,
  ActorNotPermittedError,
} from '@/services/actors/resolveCreationActor';
import { resolveRequestAuth, hasScope } from '@/lib/api/resolveRequestAuth';
import {
  claimIdempotencyKey,
  completeIdempotencyResult,
  hashRequestBody,
  releaseIdempotencyClaim,
  shouldCacheStatus,
  waitForIdempotencyResult,
} from '@/services/idempotency/idempotencyResults';
import { enqueueWebhookEvent } from '@/services/webhooks/deliveryService';
import { auditLog, AUDIT_ACTIONS } from '@/lib/api/auditLog';
import { clientIpOrUndefined } from '@/lib/client-ip';

// Type for the awaited Supabase client
type SupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

// ==================== TYPES ====================

interface EntityPostHandlerConfig {
  /** Entity type from registry */
  entityType: EntityType;
  /** Zod schema for validation */
  schema: ZodSchema;
  /** Override table name (uses registry tableName if not specified) */
  tableName?: string;
  /** Function to transform validated data before insertion */
  transformData?: (
    data: Record<string, unknown>,
    userId: string,
    supabase: SupabaseClient
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
  /** Custom creation function (if entity has special creation logic) */
  createEntity?: (
    userId: string,
    data: Record<string, unknown>,
    supabase: SupabaseClient
  ) => Promise<Record<string, unknown>>;
  /** Whether to use actor-based ownership (insert actor_id instead of user_id) */
  useActorOwnership?: boolean;
  /** Additional fields to set on insert (e.g., current_attendees: 0) */
  defaultFields?: Record<string, unknown>;
}

// ==================== HANDLER FACTORY ====================

/**
 * Creates a POST handler for entity creation endpoints
 *
 * @example
 * ```typescript
 * export const POST = createEntityPostHandler({
 *   entityType: 'event',
 *   schema: eventSchema,
 *   transformData: (data, userId) => ({
 *     ...data,
 *     user_id: userId,
 *     start_date: typeof data.start_date === 'string' ? data.start_date : data.start_date?.toISOString(),
 *   }),
 *   defaultFields: { current_attendees: 0 },
 * });
 * ```
 */
export function createEntityPostHandler(config: EntityPostHandlerConfig) {
  const {
    entityType,
    schema,
    tableName,
    transformData,
    createEntity,
    useActorOwnership = false,
    defaultFields = {},
  } = config;

  const meta = getEntityMetadata(entityType);
  const table = tableName ?? meta.tableName;

  // Allow callers to send `actor_id` to create on behalf of a group they
  // belong to (validated server-side). Object schemas are extended so Zod
  // doesn't strip the field during validation; non-object schemas pass
  // through untouched and silently ignore the field.
  const schemaWithActor: ZodSchema =
    schema instanceof ZodObject
      ? (schema as ZodObject<z.ZodRawShape>).extend({
          actor_id: z.string().guid().optional(),
        })
      : schema;

  return compose(
    withRequestId(),
    withZodBody(schemaWithActor)
  )(async (request: NextRequest, ctx) => {
    // Hoisted so the outer catch can release a pending claim if the
    // request throws mid-flight. ownsIdempotencyClaim flips to true
    // inside the try when we win the claim race and back to false when
    // cacheResult publishes the completion.
    let userId: string | null = null;
    let idempotencyKey: string | null = null;
    let requestPath = '';
    let ownsIdempotencyClaim = false;

    try {
      const auth = await resolveRequestAuth(request);
      if (!auth) {
        return apiUnauthorized();
      }
      // Scope check applies BEFORE idempotency + rate limit so a
      // forbidden request can't burn a claim slot or quota.
      if (!hasScope(auth.scopes, `${entityType}.write`)) {
        logger.warn(`Scope denied for ${entityType}.write`, {
          userId: auth.userId,
          source: auth.source,
          integrationKeyId: auth.integrationKeyId,
          scopes: auth.scopes,
        });
        return apiForbidden(`This key is not allowed to write ${meta.namePlural.toLowerCase()}.`);
      }
      userId = auth.userId;
      // Bearer callers (OIDC "Login with OrangeCat", ock_ integration keys) carry
      // no Supabase session, so a cookie-session client runs as anon and RLS
      // rejects the insert (42501 "new row violates row-level security policy").
      // Authorization is already fully enforced above (resolveRequestAuth +
      // hasScope + resolveCreationActor set the row's actor), so for non-session
      // auth we write via the service-role client and rely on that app-layer
      // authz — the same pattern services/timeline/externalPublish.ts documents
      // and uses for external event ingest.
      const supabase = auth.source === 'session' ? await createServerClient() : createAdminClient();

      // Idempotency-Key dedup. Runs BEFORE rate limiting so a retry of a
      // successful request doesn't consume quota a second time.
      idempotencyKey = request.headers.get('idempotency-key');
      const bodyHash = idempotencyKey ? hashRequestBody(ctx.body) : undefined;
      // URL parsing only when we'll actually use it — `request.url` may be
      // undefined in unit-test mocks of NextRequest.
      requestPath = idempotencyKey && request.url ? new URL(request.url).pathname : '';

      if (idempotencyKey && bodyHash && requestPath) {
        const claim = await claimIdempotencyKey({
          userId,
          key: idempotencyKey,
          method: 'POST',
          path: requestPath,
          bodyHash,
        });

        if (claim.kind === 'replay') {
          logger.info(`${meta.name} idempotency replay`, {
            userId,
            path: requestPath,
            cachedStatus: claim.hit.responseStatus,
          });
          return NextResponse.json(claim.hit.responseBody, {
            status: claim.hit.responseStatus,
            headers: { 'Idempotency-Replay': 'true' },
          });
        }

        if (claim.kind === 'body_mismatch') {
          return apiForbidden(
            'Idempotency-Key was reused with a different request body. Generate a new key for each distinct request.'
          );
        }

        if (claim.kind === 'wait') {
          // Another request is in flight for the same key. Poll until it
          // finishes; never duplicate the work.
          const winner = await waitForIdempotencyResult({
            userId,
            key: idempotencyKey,
            path: requestPath,
          });
          if (winner) {
            logger.info(`${meta.name} idempotency wait-and-replay`, {
              userId,
              path: requestPath,
              cachedStatus: winner.responseStatus,
            });
            return NextResponse.json(winner.responseBody, {
              status: winner.responseStatus,
              headers: { 'Idempotency-Replay': 'true' },
            });
          }
          // Owner timed out without completing. Tell the client to retry
          // with the same key — a future attempt either sees the
          // completion or wins fresh.
          return apiRateLimited(
            'Another request with this Idempotency-Key is still in flight. Retry shortly.',
            5
          );
        }

        // claim.kind === 'won' — we own the row, must complete it on the way out.
        ownsIdempotencyClaim = true;
      }

      /** Publish the response to the idempotency cache when WE claimed
       * the row at the top. Skipped for non-owners (already returned),
       * for requests without a key, and for 5xx (server may recover on
       * retry — caching a transient failure would lock the client out). */
      // Capture userId in a closure-friendly const — the outer let is
      // string | null because the catch handler also reads it after a
      // possible early return.
      const claimUserId = userId;
      const cacheResult = async (response: NextResponse): Promise<NextResponse> => {
        if (!ownsIdempotencyClaim || !idempotencyKey || !bodyHash) {
          return response;
        }
        if (!shouldCacheStatus(response.status)) {
          // 5xx — don't cache, but DO release the pending row so a
          // future retry can win fresh instead of polling a permanently
          // stuck row for 24h.
          await releaseIdempotencyClaim({
            userId: claimUserId,
            key: idempotencyKey,
            path: requestPath,
          });
          ownsIdempotencyClaim = false;
          return response;
        }
        try {
          const body = await response.clone().json();
          await completeIdempotencyResult({
            userId: claimUserId,
            key: idempotencyKey,
            path: requestPath,
            responseStatus: response.status,
            responseBody: body,
          });
          ownsIdempotencyClaim = false;
        } catch (cacheErr) {
          logger.warn('idempotency complete failed (non-fatal)', { cacheErr });
        }
        return response;
      };

      // Rate limiting. Integration-key requests get a per-key bucket so
      // one buggy key can't starve the user's other keys; session
      // requests use the per-user bucket as before.
      const rateLimit =
        auth.source === 'integration_key' && auth.integrationKeyId
          ? await rateLimitIntegrationKeyWrite(auth.integrationKeyId)
          : await rateLimitWriteAsync(userId);
      if (!rateLimit.success) {
        const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
        logger.warn(`${meta.name} creation rate limit exceeded`, {
          userId,
          authSource: auth.source,
          integrationKeyId: auth.integrationKeyId,
        });
        return apiRateLimited(
          `Too many ${meta.name.toLowerCase()} creation requests. Please slow down.`,
          retryAfter
        );
      }

      // Strip body.actor_id so every downstream code path sees a body
      // without it. Integration-key auth has a fixed bound actor; session
      // auth uses the body field as the requested actor.
      const bodyForHandler = { ...(ctx.body as Record<string, unknown>) };
      const requestedActorId = bodyForHandler.actor_id as string | undefined;
      delete bodyForHandler.actor_id;

      let resolvedActor: { id: string };
      if (auth.boundActorId) {
        // Integration key — the key itself proves authority. Body
        // actor_id (if any) is ignored to avoid confusing the audit trail.
        resolvedActor = { id: auth.boundActorId };
      } else {
        try {
          resolvedActor = await resolveCreationActor(userId, requestedActorId);
        } catch (actorError) {
          if (actorError instanceof ActorNotPermittedError) {
            return apiForbidden(
              `You are not permitted to create a ${meta.name.toLowerCase()} as the requested actor.`
            );
          }
          throw actorError;
        }
      }

      // Fire-and-forget audit trail for every successful entity creation. Never
      // blocks or fails the response (auditLog swallows its own errors). One place
      // here covers all 10+ factory-based create routes (DRY).
      const recordAudit = (entityId: string): void => {
        void auditLog({
          action: AUDIT_ACTIONS.ENTITY_CREATED,
          userId,
          entityType,
          entityId,
          metadata: { actorId: resolvedActor.id, source: auth.source },
          // The hop Caddy wrote. The first hop is caller-supplied, so recording
          // it let anyone choose what the audit trail said about them.
          ipAddress: clientIpOrUndefined(request),
          userAgent: request.headers.get('user-agent') || undefined,
        });
      };

      // Use custom creation function if provided (for domain services).
      // Pass the resolved actor on the body's `_resolved_actor_id` side
      // channel — domain/base/entityService.ts unwraps it.
      if (createEntity) {
        const bodyForCreate = {
          ...bodyForHandler,
          _resolved_actor_id: resolvedActor.id,
          _resolved_is_test: auth.isTest,
        };
        const entity = await createEntity(userId, bodyForCreate, supabase);
        logger.info(`${meta.name} created successfully`, { [`${entityType}Id`]: entity.id });
        recordAudit(entity.id as string);
        // Fire-and-forget: never block the user response on webhook
        // enqueue. enqueueWebhookEvent swallows its own errors.
        void enqueueWebhookEvent({
          actorId: resolvedActor.id,
          eventType: `${entityType}.created`,
          payload: entity,
        });
        return cacheResult(
          applyRateLimitHeaders(apiSuccess(entity, { status: 201 }), rateLimit as RateLimitResult)
        );
      }

      // Default creation: transform data and insert
      let transformedData;
      try {
        if (transformData) {
          transformedData = await Promise.resolve(transformData(bodyForHandler, userId, supabase));
          // Honour the resolved actor whether the transform set actor_id or not.
          if (useActorOwnership !== false) {
            (transformedData as Record<string, unknown>).actor_id = resolvedActor.id;
          }
        } else if (useActorOwnership !== false) {
          transformedData = { ...bodyForHandler, actor_id: resolvedActor.id };
        } else {
          transformedData = { ...bodyForHandler, user_id: userId };
        }
      } catch (transformError) {
        logger.error(`Error transforming data for ${entityType}`, {
          error: transformError,
          bodyKeys: Object.keys(ctx.body || {}),
          userId: userId,
        });
        const errorMessage =
          transformError instanceof Error ? transformError.message : String(transformError);
        return apiInternalError(`Failed to process ${meta.name.toLowerCase()}: ${errorMessage}`);
      }

      // Stamp sandbox flag onto the default-insert path too. The
      // createEntity custom path threads via _resolved_is_test side
      // channel; this branch goes directly to supabase.insert. Place
      // is_test LAST so neither the body nor defaultFields can override
      // it — the sandbox flag must come from auth, never from the caller.
      const entityData: Record<string, unknown> = {
        ...transformedData,
        ...defaultFields,
      };
      // Only stamp is_test when true (sandbox). It only exists on the public-API
      // entity tables; injecting `false` everywhere 400s tables without the
      // column. When true it's still applied here (last), so a caller can't spoof it.
      if (auth.isTest) {
        entityData.is_test = true;
      }

      // Extract _wallet_id before DB insert (not a real column)
      const walletIdForLink = entityData._wallet_id as string | undefined;
      delete entityData._wallet_id;

      // Log the data being inserted for debugging
      logger.info(`Inserting ${entityType}`, {
        table,
        userId: userId,
        dataKeys: Object.keys(entityData),
        entityDataSample: JSON.stringify(entityData, null, 2).substring(0, 500),
      });

      // `table` is a runtime string so the row type can't be inferred from
      // Supabase's generated unions; `entityData` is the validated payload.

      const { data: entity, error } = await fromTable(supabase, table)
        .insert(entityData)
        .select()
        .single();

      if (error) {
        const errorDetails = {
          error,
          userId: userId,
          table,
          code: error?.code,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          entityDataKeys: Object.keys(entityData),
          // Also log the raw error object
          rawError: JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2),
        };
        logger.error(`Error creating ${entityType}`, errorDetails);
        // Return generic error to client — details are already logged above
        return apiInternalError(`Failed to create ${meta.name.toLowerCase()}`);
      }

      const createdEntity = entity as { id: string } & Record<string, unknown>;
      logger.info(`${meta.name} created successfully`, { [`${entityType}Id`]: createdEntity.id });
      recordAudit(createdEntity.id);

      // Link wallet to entity if _wallet_id was provided (non-fatal)
      if (walletIdForLink && createdEntity.id) {
        try {
          // entity_wallets table may not be in generated Supabase types yet

          await fromTable(supabase, DATABASE_TABLES.ENTITY_WALLETS).insert({
            wallet_id: walletIdForLink,
            entity_type: entityType,
            entity_id: createdEntity.id,
            is_primary: true,
            created_by: userId,
          });
          logger.info(`Wallet linked to ${entityType}`, {
            walletId: walletIdForLink,
            entityId: createdEntity.id,
          });
        } catch (linkError) {
          logger.warn(`Failed to link wallet to ${entityType} (non-fatal)`, {
            walletId: walletIdForLink,
            entityId: createdEntity.id,
            error: linkError,
          });
        }
      }

      void enqueueWebhookEvent({
        actorId: resolvedActor.id,
        eventType: `${entityType}.created`,
        payload: createdEntity,
      });
      return cacheResult(
        applyRateLimitHeaders(
          apiSuccess(createdEntity, { status: 201 }),
          rateLimit as RateLimitResult
        )
      );
    } catch (error) {
      // If we claimed an idempotency row at the top and the request
      // threw before completing, release the row so a future retry can
      // win fresh instead of polling a stuck pending row for 24h.
      if (ownsIdempotencyClaim && userId && idempotencyKey && requestPath) {
        await releaseIdempotencyClaim({ userId, key: idempotencyKey, path: requestPath });
      }
      return handleApiError(error);
    }
  });
}
