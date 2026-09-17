/**
 * Generic CRUD Handler for Entity Routes
 *
 * Provides reusable handlers for GET, PUT, DELETE operations on entities.
 * Uses the entity-registry as Single Source of Truth for metadata.
 *
 * Benefits:
 * - Eliminates code duplication across entity [id] routes
 * - Consistent error handling and logging
 * - Entity names derived from registry (no magic strings)
 * - Easy to add new entity types
 *
 * Created: 2025-12-25
 */

import { fromTable } from '@/lib/supabase/untyped';
import { NextRequest, NextResponse } from 'next/server';
import type { AnySupabaseClient } from '@/lib/supabase/types';

import { ZodSchema, ZodError } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiValidationError,
  handleApiError,
  handleSupabaseError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import {
  rateLimit,
  rateLimitWriteAsync,
  createRateLimitResponse,
  applyRateLimitHeaders,
  type RateLimitResult,
} from '@/lib/rate-limit';
import { logger } from '@/utils/logger';
import { getAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { type EntityType, getEntityMetadata } from '@/config/entity-registry';
import { ENTITY_STATUS } from '@/config/database-constants';
import { checkOwnership } from '@/services/actors';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import { validateUUID } from '@/lib/api/validation';

// ==================== TYPES ====================

interface EntityHandlerConfig {
  /** Entity type from registry */
  entityType: EntityType;
  /** Zod schema for validation (optional for GET/DELETE) */
  schema?: ZodSchema;
  /** Function to build update payload from validated data */
  buildUpdatePayload?: (data: Record<string, unknown>) => Record<string, unknown>;
  /** Whether to check for 'active' status on public GET */
  requireActiveStatus?: boolean;
  /** Field name for ownership check (default: 'user_id', use 'actor_id' for unified ownership) */
  ownershipField?: string;
  /** Whether to use actor-based ownership check (requires actor_id field) */
  useActorOwnership?: boolean;
  /** Override table name (uses registry tableName if not specified) */
  tableName?: string;
  /** Whether GET requires authentication (default: false for public access) */
  requireAuthForGet?: boolean;
  /** Custom authorization check for GET (returns error response if unauthorized) */
  checkGetAccess?: (
    entity: Record<string, unknown>,
    userId: string | null,
    supabase: AnySupabaseClient
  ) => Promise<NextResponse | null>;
  /** Post-process entity after GET (add computed fields, etc.) */
  postProcessGet?: (
    entity: Record<string, unknown>,
    userId: string | null,
    supabase: AnySupabaseClient
  ) => Promise<Record<string, unknown>>;
  /** Custom authorization check for PUT (returns error response if unauthorized) */
  checkPutAccess?: (
    entity: Record<string, unknown>,
    userId: string,
    supabase: AnySupabaseClient
  ) => Promise<NextResponse | null>;
  /** Post-process entity after PUT (audit logging, etc.) */
  postProcessPut?: (
    entity: Record<string, unknown>,
    userId: string,
    supabase: AnySupabaseClient
  ) => Promise<void>;
  /** Custom authorization check for DELETE (returns error response if unauthorized) */
  checkDeleteAccess?: (
    entity: Record<string, unknown>,
    userId: string,
    supabase: AnySupabaseClient
  ) => Promise<NextResponse | null>;
  /** Pre-delete hook (cleanup operations, etc.) */
  preDelete?: (
    entity: Record<string, unknown>,
    userId: string,
    supabase: AnySupabaseClient
  ) => Promise<void>;
  /** Post-process after DELETE (audit logging, etc.) */
  postProcessDelete?: (
    entity: Record<string, unknown>,
    userId: string,
    supabase: AnySupabaseClient
  ) => Promise<void>;
  /** Custom cache control for GET */
  getCacheControl?: (entity: Record<string, unknown>, userId: string | null) => string;
}

interface EntityRouteParams {
  params: Promise<{ id: string }> | { id: string };
}

async function routeId(params: EntityRouteParams['params']): Promise<string | undefined> {
  const resolved = await params;
  return resolved?.id;
}

// ==================== HELPERS ====================

async function defaultOwnershipCheck(
  existing: Record<string, unknown>,
  userId: string,
  ownershipField: string,
  useActorOwnership: boolean | undefined,
  action: 'update' | 'delete',
  entityNamePlural: string,
  // Pass the route's already-authed server supabase client. Without it,
  // checkOwnership silently falls back to the browser client (no cookies
  // in serverless), the actor fetch returns null, and every PUT/DELETE on
  // an actor-owned entity 403s for the legitimate owner. Mirrors the fix
  // shipped in 136f65ac for the STATUS endpoint.

  supabase?: any
): Promise<NextResponse | null> {
  if (useActorOwnership && existing.actor_id) {
    const hasAccess = await checkOwnership(existing as { actor_id: string }, userId, supabase);
    if (!hasAccess) {
      return apiForbidden(`You can only ${action} your own ${entityNamePlural}`);
    }
  } else {
    if (existing[ownershipField] !== userId) {
      return apiForbidden(`You can only ${action} your own ${entityNamePlural}`);
    }
  }
  return null;
}

// ==================== GET HANDLER ====================

/**
 * Generic GET handler for /api/[entity]/[id]
 *
 * Features:
 * - Rate limiting
 * - Optional status filtering
 * - Consistent error responses
 */
function createGetHandler(config: EntityHandlerConfig) {
  const {
    entityType,
    requireActiveStatus = true,
    tableName,
    requireAuthForGet = false,
    ownershipField = 'user_id',
    checkGetAccess,
    postProcessGet,
    getCacheControl,
  } = config;
  const meta = getEntityMetadata(entityType);
  const table = tableName ?? meta.tableName;

  return async function GET(request: NextRequest, { params }: EntityRouteParams) {
    const entityId = await routeId(params);
    const uuidCheck = validateUUID(entityId, `${meta.name} ID`);
    if (!uuidCheck.valid) {
      return uuidCheck.error!;
    }

    try {
      // Rate limiting check
      const rateLimitResult = await rateLimit(request);
      if (!rateLimitResult.success) {
        return createRateLimitResponse(rateLimitResult);
      }

      const supabase = await createServerClient();

      // Handle authentication (optional for GET)
      let userId: string | null = null;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
      }

      if (requireAuthForGet && !userId) {
        return apiUnauthorized();
      }

      let query = fromTable(supabase, table).select('*').eq('id', entityId);

      // If auth required, filter by ownership
      if (requireAuthForGet && userId) {
        if (config.useActorOwnership) {
          // Resolve user ID to actor ID for actor-based ownership filtering
          const actor = await getOrCreateUserActor(userId);
          query = query.eq(ownershipField, actor.id);
        } else {
          query = query.eq(ownershipField, userId);
        }
      }

      if (requireActiveStatus && !userId) {
        query = query.eq('status', ENTITY_STATUS.ACTIVE);
      }

      const { data: entity, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return apiNotFound(`${meta.name} not found`);
        }
        return handleSupabaseError(error);
      }

      // Draft/unpublished rows: owners may read; everyone else gets 404.
      if (requireActiveStatus && entity.status !== ENTITY_STATUS.ACTIVE) {
        if (!userId) {
          return apiNotFound(`${meta.name} not found`);
        }
        if (config.useActorOwnership && entity[ownershipField]) {
          const hasAccess = await checkOwnership(
            entity as { actor_id: string },
            userId,
            supabase as AnySupabaseClient
          );
          if (!hasAccess) {
            return apiNotFound(`${meta.name} not found`);
          }
        } else if (entity[ownershipField] !== userId) {
          return apiNotFound(`${meta.name} not found`);
        }
      }

      // Custom authorization check
      if (checkGetAccess) {
        const authError = await checkGetAccess(entity, userId, supabase as any);
        if (authError) {
          return authError;
        }
      }

      // Post-process entity (add computed fields, etc.)
      let processedEntity = entity;
      if (postProcessGet) {
        processedEntity = await postProcessGet(entity, userId, supabase as any);
      }

      // Custom cache control
      const cacheControl = getCacheControl ? getCacheControl(processedEntity, userId) : undefined;

      const success = apiSuccess(processedEntity, {
        headers: cacheControl ? { 'Cache-Control': cacheControl } : undefined,
      });
      return applyRateLimitHeaders(success, rateLimitResult);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

// ==================== PUT HANDLER ====================

/**
 * Generic PUT handler for /api/[entity]/[id]
 *
 * Features:
 * - Authentication check
 * - Ownership verification
 * - Rate limiting
 * - Zod validation
 * - Consistent error responses
 */
function createPutHandler(config: EntityHandlerConfig) {
  const {
    entityType,
    schema,
    buildUpdatePayload,
    ownershipField = 'user_id',
    tableName,
    checkPutAccess,
    postProcessPut,
  } = config;
  const meta = getEntityMetadata(entityType);
  const table = tableName ?? meta.tableName;

  if (!schema) {
    throw new Error(`PUT handler for ${entityType} requires a schema`);
  }

  if (!buildUpdatePayload) {
    throw new Error(`PUT handler for ${entityType} requires buildUpdatePayload`);
  }

  return async function PUT(request: NextRequest, { params }: EntityRouteParams) {
    const entityId = await routeId(params);
    const uuidCheck = validateUUID(entityId, `${meta.name} ID`);
    if (!uuidCheck.valid) {
      return uuidCheck.error!;
    }

    try {
      const supabase = await createServerClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return apiUnauthorized();
      }

      // Check if entity exists
      const { data: existingData, error: fetchError } = await fromTable(supabase, table)
        .select('*')
        .eq('id', entityId)
        .single();
      const existing = existingData as any;

      if (fetchError || !existing) {
        return apiNotFound(`${meta.name} not found`);
      }

      // Custom authorization check (if provided, use it; otherwise use default ownership check)
      if (checkPutAccess) {
        const authError = await checkPutAccess(existing, user.id, supabase as any);
        if (authError) {
          return authError;
        }
      } else {
        const ownershipError = await defaultOwnershipCheck(
          existing,
          user.id,
          ownershipField,
          config.useActorOwnership,
          'update',
          meta.namePlural.toLowerCase(),
          supabase
        );
        if (ownershipError) {
          return ownershipError;
        }
      }

      // Rate limiting check
      const rateLimitResult = await rateLimitWriteAsync(user.id);
      if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
        return apiRateLimited('Too many update requests. Please slow down.', retryAfter);
      }

      const body = await request.json();
      const validatedData = schema.parse(body);
      const updatePayload = {
        ...buildUpdatePayload(validatedData as Record<string, unknown>),
        updated_at: new Date().toISOString(),
      };

      const { data: entity, error } = await fromTable(supabase, table)
        .update(updatePayload)
        .eq('id', entityId)
        .select('*')
        .single();

      if (error) {
        logger.error(`${meta.name} update failed`, {
          userId: user.id,
          entityId,
          error: error.message,
          code: error.code,
        });
        return handleSupabaseError(error);
      }

      // Post-process (audit logging, etc.)
      if (postProcessPut) {
        await postProcessPut(entity, user.id, supabase as any);
      }

      logger.info(`${meta.name} updated successfully`, { userId: user.id, entityId });
      return applyRateLimitHeaders(apiSuccess(entity), rateLimitResult as RateLimitResult);
    } catch (error) {
      if (error instanceof ZodError) {
        return apiValidationError(`Invalid ${meta.name.toLowerCase()} data`, {
          details: error.issues,
        });
      }
      return handleApiError(error);
    }
  };
}

// ==================== DELETE HANDLER ====================

/**
 * Generic DELETE handler for /api/[entity]/[id]
 *
 * Features:
 * - Authentication check
 * - Ownership verification
 * - Consistent error responses
 */
function createDeleteHandler(config: EntityHandlerConfig) {
  const {
    entityType,
    ownershipField = 'user_id',
    tableName,
    checkDeleteAccess,
    preDelete,
    postProcessDelete,
  } = config;
  const meta = getEntityMetadata(entityType);
  const table = tableName ?? meta.tableName;

  return async function DELETE(_request: NextRequest, { params }: EntityRouteParams) {
    const entityId = await routeId(params);
    const uuidCheck = validateUUID(entityId, `${meta.name} ID`);
    if (!uuidCheck.valid) {
      return uuidCheck.error!;
    }

    try {
      const supabase = await createServerClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return apiUnauthorized();
      }

      // Check if entity exists
      const { data: existingData, error: fetchError } = await fromTable(supabase, table)
        .select('*')
        .eq('id', entityId)
        .single();
      const existing = existingData as any;

      if (fetchError || !existing) {
        return apiNotFound(`${meta.name} not found`);
      }

      // Custom authorization check (if provided, use it; otherwise use default ownership check)
      if (checkDeleteAccess) {
        const authError = await checkDeleteAccess(existing, user.id, supabase as any);
        if (authError) {
          return authError;
        }
      } else {
        const ownershipError = await defaultOwnershipCheck(
          existing,
          user.id,
          ownershipField,
          config.useActorOwnership,
          'delete',
          meta.namePlural.toLowerCase(),
          supabase
        );
        if (ownershipError) {
          return ownershipError;
        }
      }

      // Pre-delete hook (cleanup operations)
      if (preDelete) {
        await preDelete(existing, user.id, supabase as any);
      }

      const { error } = await fromTable(supabase, table).delete().eq('id', entityId);

      if (error) {
        logger.error(`${meta.name} deletion failed`, {
          userId: user.id,
          entityId,
          error: error.message,
          code: error.code,
        });
        return handleSupabaseError(error);
      }

      // entity_wallets is polymorphic (entity_type + entity_id), so Postgres
      // cannot cascade it — the rows outlive the entity. Prod accumulated links
      // pointing at deleted entities, and the shared-wallet disclosure counted
      // them as live pages until it started verifying visibility. Clean them
      // here, in the one handler every entity type deletes through.
      // Admin client: authorization already happened above, and the link row is
      // not necessarily readable under the deleter's own RLS scope.
      const { error: linkError } = await (getAdminClient() as unknown as AnySupabaseClient)
        .from(DATABASE_TABLES.ENTITY_WALLETS)
        .delete()
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);
      if (linkError) {
        // The entity is already gone; a stale link is a hygiene problem, not a
        // reason to report the delete as failed.
        logger.warn('entity_wallets cleanup failed after entity delete', {
          entityType,
          entityId,
          error: linkError.message,
        });
      }

      // Post-process (audit logging, etc.)
      if (postProcessDelete) {
        await postProcessDelete(existing, user.id, supabase as any);
      }

      logger.info(`${meta.name} deleted successfully`, { userId: user.id, entityId });
      return apiSuccess({ message: `${meta.name} deleted successfully` });
    } catch (error) {
      return handleApiError(error);
    }
  };
}

// ==================== FACTORY FUNCTION ====================

/**
 * Create all CRUD handlers for an entity type
 *
 * Usage:
 * ```typescript
 * const { GET, PUT, DELETE } = createEntityCrudHandlers({
 *   entityType: 'product',
 *   schema: userProductSchema,
 *   buildUpdatePayload: (data) => ({
 *     title: data.title,
 *     price: data.price,
 *     // ... entity-specific fields
 *   }),
 * });
 *
 * export { GET, PUT, DELETE };
 * ```
 */
export function createEntityCrudHandlers(config: EntityHandlerConfig) {
  return {
    GET: createGetHandler(config),
    PUT: createPutHandler(config),
    DELETE: createDeleteHandler(config),
  };
}
