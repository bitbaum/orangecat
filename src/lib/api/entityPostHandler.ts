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

// ==================== PHASES ====================
//
// The handler below reads as its phases, in order: authenticate, check the
// write scope, claim the Idempotency-Key, rate-limit, resolve the acting
// actor, then create (through the entity's own service, or the default
// insert). Each phase that can end the request returns a Response for the
// handler to send; the handler sends it unchanged.
//
// Order is behaviour and is pinned by
// __tests__/unit/lib/api/entityPostHandler.characterization.test.ts — so is
// which early returns touch the idempotency claim (most do not).

type EntityMeta = ReturnType<typeof getEntityMetadata>;
type ResolvedAuth = NonNullable<Awaited<ReturnType<typeof resolveRequestAuth>>>;
type WriteClient = SupabaseClient | ReturnType<typeof createAdminClient>;

/**
 * The Idempotency-Key claim this request holds, shared between the success
 * path (which completes or releases it) and the handler's catch (which
 * releases it if the request throws mid-flight). `owned` is true from winning
 * the claim until it is completed or released.
 */
interface IdempotencyState {
  userId: string | null;
  key: string | null;
  path: string;
  bodyHash: string | undefined;
  owned: boolean;
}

/** 403 when the caller's scopes do not include `<entity>.write`. */
function refuseWithoutWriteScope(
  auth: ResolvedAuth,
  entityType: EntityType,
  meta: EntityMeta
): NextResponse | null {
  if (hasScope(auth.scopes, `${entityType}.write`)) {
    return null;
  }
  logger.warn(`Scope denied for ${entityType}.write`, {
    userId: auth.userId,
    source: auth.source,
    integrationKeyId: auth.integrationKeyId,
    scopes: auth.scopes,
  });
  return apiForbidden(`This key is not allowed to write ${meta.namePlural.toLowerCase()}.`);
}

/** A cached (or in-flight twin's) response, replayed verbatim. */
function replay(hit: { responseStatus: number; responseBody: unknown }): NextResponse {
  return NextResponse.json(hit.responseBody, {
    status: hit.responseStatus,
    headers: { 'Idempotency-Replay': 'true' },
  });
}

/**
 * Idempotency-Key dedup. Runs BEFORE rate limiting so a retry of a successful
 * request doesn't consume quota a second time. Returns a response when the
 * request must end here (replay, body mismatch, twin still in flight); on a
 * won claim, marks `state.owned`.
 */
async function claimIdempotency(
  request: NextRequest,
  body: unknown,
  userId: string,
  state: IdempotencyState,
  meta: EntityMeta
): Promise<NextResponse | null> {
  state.key = request.headers.get('idempotency-key');
  state.bodyHash = state.key ? hashRequestBody(body) : undefined;
  // URL parsing only when we'll actually use it — `request.url` may be
  // undefined in unit-test mocks of NextRequest.
  state.path = state.key && request.url ? new URL(request.url).pathname : '';

  const { key, bodyHash, path } = state;
  if (!(key && bodyHash && path)) {
    return null;
  }
  const claim = await claimIdempotencyKey({ userId, key, method: 'POST', path, bodyHash });

  if (claim.kind === 'replay') {
    logger.info(`${meta.name} idempotency replay`, {
      userId,
      path,
      cachedStatus: claim.hit.responseStatus,
    });
    return replay(claim.hit);
  }

  if (claim.kind === 'body_mismatch') {
    return apiForbidden(
      'Idempotency-Key was reused with a different request body. Generate a new key for each distinct request.'
    );
  }

  if (claim.kind === 'wait') {
    // Another request is in flight for the same key. Poll until it
    // finishes; never duplicate the work.
    const winner = await waitForIdempotencyResult({ userId, key, path });
    if (winner) {
      logger.info(`${meta.name} idempotency wait-and-replay`, {
        userId,
        path,
        cachedStatus: winner.responseStatus,
      });
      return replay(winner);
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
  state.owned = true;
  return null;
}

/**
 * Publish the response to the idempotency cache when WE claimed the row.
 * Skipped for non-owners (already returned), for requests without a key, and
 * for 5xx (server may recover on retry — caching a transient failure would
 * lock the client out).
 */
async function publishToIdempotencyCache(
  response: NextResponse,
  state: IdempotencyState,
  userId: string
): Promise<NextResponse> {
  if (!state.owned || !state.key || !state.bodyHash) {
    return response;
  }
  if (!shouldCacheStatus(response.status)) {
    // 5xx — don't cache, but DO release the pending row so a
    // future retry can win fresh instead of polling a permanently
    // stuck row for 24h.
    await releaseIdempotencyClaim({ userId, key: state.key, path: state.path });
    state.owned = false;
    return response;
  }
  try {
    const body = await response.clone().json();
    await completeIdempotencyResult({
      userId,
      key: state.key,
      path: state.path,
      responseStatus: response.status,
      responseBody: body,
    });
    state.owned = false;
  } catch (cacheErr) {
    logger.warn('idempotency complete failed (non-fatal)', { cacheErr });
  }
  return response;
}

/**
 * Rate limiting. Integration-key requests get a per-key bucket so one buggy
 * key can't starve the user's other keys; session requests use the per-user
 * bucket. Returns the result to put on the success response, or a 429.
 */
async function rateLimitCreate(
  auth: ResolvedAuth,
  userId: string,
  meta: EntityMeta
): Promise<{ result: RateLimitResult } | { response: NextResponse }> {
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
    return {
      response: apiRateLimited(
        `Too many ${meta.name.toLowerCase()} creation requests. Please slow down.`,
        retryAfter
      ),
    };
  }
  return { result: rateLimit as RateLimitResult };
}

/**
 * The actor the entity is created as. Integration-key auth has a fixed bound
 * actor — the key itself proves authority, and a body actor_id (if any) is
 * ignored to avoid confusing the audit trail. Session auth uses the requested
 * actor, validated by resolveCreationActor. Returns a 403 when the caller may
 * not act as the requested actor; any other failure is thrown.
 */
async function resolveActingActor(
  auth: ResolvedAuth,
  userId: string,
  requestedActorId: string | undefined,
  meta: EntityMeta
): Promise<{ actor: { id: string } } | { response: NextResponse }> {
  if (auth.boundActorId) {
    return { actor: { id: auth.boundActorId } };
  }
  try {
    return { actor: await resolveCreationActor(userId, requestedActorId) };
  } catch (actorError) {
    if (actorError instanceof ActorNotPermittedError) {
      return {
        response: apiForbidden(
          `You are not permitted to create a ${meta.name.toLowerCase()} as the requested actor.`
        ),
      };
    }
    throw actorError;
  }
}

/** Everything the two creation paths need, resolved by the phases above. */
interface CreateContext {
  request: NextRequest;
  auth: ResolvedAuth;
  userId: string;
  supabase: WriteClient;
  actor: { id: string };
  /** The validated body, without actor_id. */
  body: Record<string, unknown>;
  /** The validated body as received, for logging its keys. */
  rawBody: unknown;
}

/**
 * Fire-and-forget audit trail for every successful entity creation. Never
 * blocks or fails the response (auditLog swallows its own errors). One place
 * here covers all 10+ factory-based create routes (DRY).
 */
function recordCreationAudit(ctx: CreateContext, entityType: EntityType, entityId: string): void {
  void auditLog({
    action: AUDIT_ACTIONS.ENTITY_CREATED,
    userId: ctx.userId,
    entityType,
    entityId,
    metadata: { actorId: ctx.actor.id, source: ctx.auth.source },
    // The hop Caddy wrote. The first hop is caller-supplied, so recording
    // it let anyone choose what the audit trail said about them.
    ipAddress: clientIpOrUndefined(ctx.request),
    userAgent: ctx.request.headers.get('user-agent') || undefined,
  });
}

/** A creation phase's outcome: the created entity, or a response that ends the request. */
type CreateOutcome = { created: unknown } | { response: NextResponse };

/**
 * Creation through the entity's own domain service. The resolved actor and
 * the sandbox flag travel on the body's `_resolved_*` side channels —
 * domain/base/entityService.ts unwraps them.
 */
async function createThroughService(
  ctx: CreateContext,
  entityType: EntityType,
  meta: EntityMeta,
  createEntity: NonNullable<EntityPostHandlerConfig['createEntity']>
): Promise<CreateOutcome> {
  const bodyForCreate = {
    ...ctx.body,
    _resolved_actor_id: ctx.actor.id,
    _resolved_is_test: ctx.auth.isTest,
  };
  const entity = await createEntity(ctx.userId, bodyForCreate, ctx.supabase as SupabaseClient);
  logger.info(`${meta.name} created successfully`, { [`${entityType}Id`]: entity.id });
  recordCreationAudit(ctx, entityType, entity.id as string);
  // Fire-and-forget: never block the user response on webhook
  // enqueue. enqueueWebhookEvent swallows its own errors.
  void enqueueWebhookEvent({
    actorId: ctx.actor.id,
    eventType: `${entityType}.created`,
    payload: entity,
  });
  return { created: entity };
}

/**
 * The body as the entity's columns: transformData's output, or the body plus
 * its owner (actor_id or user_id). Throws whatever transformData throws.
 */
async function transformBody(
  ctx: CreateContext,
  config: Pick<EntityPostHandlerConfig, 'transformData' | 'useActorOwnership'>
): Promise<Record<string, unknown>> {
  const { transformData, useActorOwnership } = config;
  let transformedData;
  if (transformData) {
    transformedData = await Promise.resolve(
      transformData(ctx.body, ctx.userId, ctx.supabase as SupabaseClient)
    );
    // Honour the resolved actor whether the transform set actor_id or not.
    if (useActorOwnership !== false) {
      (transformedData as Record<string, unknown>).actor_id = ctx.actor.id;
    }
  } else if (useActorOwnership !== false) {
    transformedData = { ...ctx.body, actor_id: ctx.actor.id };
  } else {
    transformedData = { ...ctx.body, user_id: ctx.userId };
  }
  return transformedData;
}

/**
 * The row to insert: the transformed body, then defaultFields, then — last,
 * so neither can spoof it — the sandbox flag.
 */
function assembleRow(
  ctx: CreateContext,
  transformedData: Record<string, unknown>,
  defaultFields: Record<string, unknown> | undefined
): Record<string, unknown> {
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
  if (ctx.auth.isTest) {
    entityData.is_test = true;
  }
  return entityData;
}

/** Link a wallet to the new entity when `_wallet_id` was provided. Non-fatal. */
async function linkWallet(
  ctx: CreateContext,
  entityType: EntityType,
  walletId: string,
  entityId: string
): Promise<void> {
  try {
    await fromTable(ctx.supabase, DATABASE_TABLES.ENTITY_WALLETS).insert({
      wallet_id: walletId,
      entity_type: entityType,
      entity_id: entityId,
      is_primary: true,
      created_by: ctx.userId,
    });
    logger.info(`Wallet linked to ${entityType}`, { walletId, entityId });
  } catch (linkError) {
    logger.warn(`Failed to link wallet to ${entityType} (non-fatal)`, {
      walletId,
      entityId,
      error: linkError,
    });
  }
}

/** Default creation: build the row, insert it, link a wallet, announce it. */
async function insertEntity(
  ctx: CreateContext,
  entityType: EntityType,
  meta: EntityMeta,
  table: string,
  config: Pick<EntityPostHandlerConfig, 'transformData' | 'useActorOwnership' | 'defaultFields'>
): Promise<CreateOutcome> {
  let transformedData: Record<string, unknown>;
  try {
    transformedData = await transformBody(ctx, config);
  } catch (transformError) {
    logger.error(`Error transforming data for ${entityType}`, {
      error: transformError,
      bodyKeys: Object.keys(ctx.rawBody || {}),
      userId: ctx.userId,
    });
    const errorMessage =
      transformError instanceof Error ? transformError.message : String(transformError);
    return {
      response: apiInternalError(`Failed to process ${meta.name.toLowerCase()}: ${errorMessage}`),
    };
  }
  const entityData = assembleRow(ctx, transformedData, config.defaultFields);

  // Extract _wallet_id before DB insert (not a real column)
  const walletIdForLink = entityData._wallet_id as string | undefined;
  delete entityData._wallet_id;

  // Log the data being inserted for debugging
  logger.info(`Inserting ${entityType}`, {
    table,
    userId: ctx.userId,
    dataKeys: Object.keys(entityData),
    entityDataSample: JSON.stringify(entityData, null, 2).substring(0, 500),
  });

  // `table` is a runtime string so the row type can't be inferred from
  // Supabase's generated unions; `entityData` is the validated payload.
  const { data: entity, error } = await fromTable(ctx.supabase, table)
    .insert(entityData)
    .select()
    .single();

  if (error) {
    const errorDetails = {
      error,
      userId: ctx.userId,
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
    return { response: apiInternalError(`Failed to create ${meta.name.toLowerCase()}`) };
  }

  const createdEntity = entity as { id: string } & Record<string, unknown>;
  logger.info(`${meta.name} created successfully`, { [`${entityType}Id`]: createdEntity.id });
  recordCreationAudit(ctx, entityType, createdEntity.id);

  if (walletIdForLink && createdEntity.id) {
    await linkWallet(ctx, entityType, walletIdForLink, createdEntity.id);
  }

  void enqueueWebhookEvent({
    actorId: ctx.actor.id,
    eventType: `${entityType}.created`,
    payload: createdEntity,
  });
  return { created: createdEntity };
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
    // Lives outside the try so the catch can release a claim this request
    // won if it throws mid-flight.
    const idempotency: IdempotencyState = {
      userId: null,
      key: null,
      path: '',
      bodyHash: undefined,
      owned: false,
    };

    try {
      const auth = await resolveRequestAuth(request);
      if (!auth) {
        return apiUnauthorized();
      }
      // Scope check applies BEFORE idempotency + rate limit so a
      // forbidden request can't burn a claim slot or quota.
      const scopeRefusal = refuseWithoutWriteScope(auth, entityType, meta);
      if (scopeRefusal) {
        return scopeRefusal;
      }
      const userId = auth.userId;
      idempotency.userId = userId;
      // Bearer callers (OIDC "Login with OrangeCat", ock_ integration keys) carry
      // no Supabase session, so a cookie-session client runs as anon and RLS
      // rejects the insert (42501 "new row violates row-level security policy").
      // Authorization is already fully enforced above (resolveRequestAuth +
      // hasScope + resolveCreationActor set the row's actor), so for non-session
      // auth we write via the service-role client and rely on that app-layer
      // authz — the same pattern services/timeline/externalPublish.ts documents
      // and uses for external event ingest.
      const supabase = auth.source === 'session' ? await createServerClient() : createAdminClient();

      const idempotencyResponse = await claimIdempotency(
        request,
        ctx.body,
        userId,
        idempotency,
        meta
      );
      if (idempotencyResponse) {
        return idempotencyResponse;
      }

      const limited = await rateLimitCreate(auth, userId, meta);
      if ('response' in limited) {
        return limited.response;
      }

      // Strip body.actor_id so every downstream code path sees a body
      // without it. Integration-key auth has a fixed bound actor; session
      // auth uses the body field as the requested actor.
      const body = { ...(ctx.body as Record<string, unknown>) };
      const requestedActorId = body.actor_id as string | undefined;
      delete body.actor_id;

      const acting = await resolveActingActor(auth, userId, requestedActorId, meta);
      if ('response' in acting) {
        return acting.response;
      }

      const createCtx: CreateContext = {
        request,
        auth,
        userId,
        supabase,
        actor: acting.actor,
        body,
        rawBody: ctx.body,
      };

      // Use custom creation function if provided (for domain services).
      const outcome = createEntity
        ? await createThroughService(createCtx, entityType, meta, createEntity)
        : await insertEntity(createCtx, entityType, meta, table, {
            transformData,
            useActorOwnership,
            defaultFields,
          });
      if ('response' in outcome) {
        return outcome.response;
      }
      // Returned, not awaited: a failure while publishing to the idempotency
      // cache settles the response as it always has, without reaching the
      // catch below.
      return publishToIdempotencyCache(
        applyRateLimitHeaders(apiSuccess(outcome.created, { status: 201 }), limited.result),
        idempotency,
        userId
      );
    } catch (error) {
      // If we claimed an idempotency row at the top and the request
      // threw before completing, release the row so a future retry can
      // win fresh instead of polling a stuck pending row for 24h.
      const { owned, userId, key, path } = idempotency;
      if (owned && userId && key && path) {
        await releaseIdempotencyClaim({ userId, key, path });
      }
      return handleApiError(error);
    }
  });
}
