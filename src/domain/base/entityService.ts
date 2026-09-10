/**
 * Generic Entity Service Base
 *
 * Eliminates repeated boilerplate across domain services by providing
 * standard CRUD operations that work with any entity type from the registry.
 *
 * Every entity service shares the same core pattern:
 * 1. Resolve userId -> actorId via getOrCreateUserActor
 * 2. Use getTableName from entity-registry for table access
 * 3. Insert/update/delete with actor_id ownership checks
 *
 * Entity-specific services remain thin wrappers that call these base
 * functions and add domain-specific logic (e.g., slug generation, defaults).
 *
 * Created: 2026-03-31
 */

import { createServerClient } from '@/lib/supabase/server';
import { type EntityType, getTableName } from '@/config/entity-registry';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { looseClient } from '@/lib/supabase/untyped';

// ==================== TYPES ====================

interface ListPageParams {
  /** Max items to return */
  limit: number;
  /** Offset for pagination */
  offset: number;
  /** Optional user ID to scope results to a specific actor */
  userId?: string;
  /** Additional eq filters to apply (field -> value) */
  filters?: Record<string, unknown>;
  /** Columns to select (default: '*') */
  select?: string;
  /** Order by column (default: 'created_at') */
  orderBy?: string;
  /** Order direction (default: descending) */
  ascending?: boolean;
  /** When true and userId is set, include drafts (no status filter). Default: false */
  includeOwnDrafts?: boolean;
  /** Status value(s) to filter public listings. Default: 'active' */
  publicStatuses?: string[];
}

interface ListPageResult<T = Record<string, unknown>> {
  items: T[];
  total: number;
}

// ==================== BASE OPERATIONS ====================

/**
 * Generic paginated list for any entity type.
 *
 * - Resolves userId to actorId automatically
 * - Applies status filtering for public vs owner views
 * - Runs data + count queries in parallel
 */
export async function listEntityPage<T = Record<string, unknown>>(
  entityType: EntityType,
  params: ListPageParams
): Promise<ListPageResult<T>> {
  const {
    limit,
    offset,
    userId,
    filters = {},
    select = '*',
    orderBy = 'created_at',
    ascending = false,
    includeOwnDrafts = false,
    publicStatuses = ['active'],
  } = params;

  const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
  const tableName = getTableName(entityType);

  // Resolve actor if userId provided
  let actorId: string | null = null;
  if (userId) {
    const actor = await getOrCreateUserActor(userId);
    actorId = actor.id;
  }

  // Build data query
  let itemsQuery = supabase
    .from(tableName)
    .select(select)
    .order(orderBy, { ascending })
    .range(offset, offset + limit - 1);

  // Build count query
  let countQuery = supabase.from(tableName).select('*', {
    count: 'exact',
    head: true,
  });

  // Apply ownership / status filtering
  if (actorId && includeOwnDrafts) {
    // Owner viewing their own items — show all statuses
    itemsQuery = itemsQuery.eq('actor_id', actorId);
    countQuery = countQuery.eq('actor_id', actorId);
  } else if (actorId) {
    // Scoped to actor but only public statuses
    itemsQuery = itemsQuery.eq('actor_id', actorId);
    countQuery = countQuery.eq('actor_id', actorId);
    if (publicStatuses.length === 1) {
      itemsQuery = itemsQuery.eq('status', publicStatuses[0]);
      countQuery = countQuery.eq('status', publicStatuses[0]);
    } else if (publicStatuses.length > 1) {
      itemsQuery = itemsQuery.in('status', publicStatuses);
      countQuery = countQuery.in('status', publicStatuses);
    }
  } else {
    // Public listing — filter by status
    if (publicStatuses.length === 1) {
      itemsQuery = itemsQuery.eq('status', publicStatuses[0]);
      countQuery = countQuery.eq('status', publicStatuses[0]);
    } else if (publicStatuses.length > 1) {
      itemsQuery = itemsQuery.in('status', publicStatuses);
      countQuery = countQuery.in('status', publicStatuses);
    }
  }

  // Apply additional filters
  for (const [field, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      itemsQuery = itemsQuery.eq(field, value);
      countQuery = countQuery.eq(field, value);
    }
  }

  const [{ data, error: dataError }, { count, error: countError }] = await Promise.all([
    itemsQuery,
    countQuery,
  ]);

  if (dataError) {
    logger.error(`Failed to list ${entityType}`, { error: dataError.message, entityType, userId });
    throw dataError;
  }
  if (countError) {
    logger.error(`Failed to count ${entityType}`, {
      error: countError.message,
      entityType,
      userId,
    });
    throw countError;
  }

  return { items: (data || []) as T[], total: count || 0 };
}

/**
 * Fetch a single entity by ID.
 *
 * Returns null if not found (PGRST116).
 */
export async function getEntity<T = Record<string, unknown>>(
  entityType: EntityType,
  id: string,
  select = '*'
): Promise<T | null> {
  const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
  const tableName = getTableName(entityType);

  const { data, error } = await supabase.from(tableName).select(select).eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    logger.error(`Failed to get ${entityType}`, { error: error.message, entityType, id });
    throw error;
  }

  return data as T;
}

/**
 * Create a new entity with automatic actor resolution.
 *
 * Resolves userId -> actorId and injects it into the payload as `actor_id`.
 * Returns the created row.
 */
/**
 * Carry the API layer's side-channels into a payload a domain service rebuilt.
 *
 * entityPostHandler resolves the owning actor (a group the caller may act for,
 * or the placeholder of a page set up for someone else — ADR-0005) and passes
 * it as `_resolved_actor_id`. A service that builds its insert from named
 * fields drops it, and createEntity then falls back to the caller's own actor:
 * exactly what happened in prod on 2026-09-10, where a project "for
 * Walkthrough Testperson" was owned by the steward. Every service that
 * rebuilds its payload wraps it in this; a unit test greps for the wrapper.
 */
export function withResolvedActor<T extends Record<string, unknown>>(
  source: unknown,
  fields: T
): T & { _resolved_actor_id?: string; _resolved_is_test?: boolean } {
  const src = (source ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...fields };
  if (typeof src._resolved_actor_id === 'string') {
    out._resolved_actor_id = src._resolved_actor_id;
  }
  if (src._resolved_is_test === true) {
    out._resolved_is_test = true;
  }
  return out as T & { _resolved_actor_id?: string; _resolved_is_test?: boolean };
}

export async function createEntity<T = Record<string, unknown>>(
  entityType: EntityType,
  userId: string,
  data: Record<string, unknown>,
  options?: {
    /** Override the supabase client (e.g., use admin client) */
    client?: AnySupabaseClient;
    /** Column to select after insert (default: '*') */
    select?: string;
  }
): Promise<T> {
  // A pre-resolved actor (e.g. a group actor approved by the API layer) can be
  // piggybacked on `data` so domain-service signatures don't have to change.
  // Same pattern as `_wallet_id` in the entity POST handler.
  const preResolvedActorId = (data as Record<string, unknown>)._resolved_actor_id as
    string | undefined;
  const actorId = preResolvedActorId ?? (await getOrCreateUserActor(userId)).id;

  // Sandbox flag side-channel — same pattern as _resolved_actor_id.
  // Session auth and live integration keys leave this undefined; only
  // sandbox-key requests set it true via entityPostHandler.
  const isTest =
    ((data as Record<string, unknown>)._resolved_is_test as boolean | undefined) ?? false;

  const client = options?.client ?? ((await createServerClient()) as unknown as AnySupabaseClient);
  const tableName = getTableName(entityType);
  const selectColumns = options?.select ?? '*';

  const sanitizedData = { ...data };
  delete (sanitizedData as Record<string, unknown>)._resolved_actor_id;
  delete (sanitizedData as Record<string, unknown>)._resolved_is_test;

  // `is_test` only exists on the public-API entity tables (migration
  // 20260604000002 added it to those 9, not to e.g. user_documents). It is only
  // ever true for sandbox-key requests, which only ever target those tables.
  // Injecting `is_test: false` on every create 400s on tables without the column
  // (document creation was fully broken by this). Only stamp it when true.
  const payload: Record<string, unknown> = {
    actor_id: actorId,
    ...sanitizedData,
  };
  if (isTest) {
    payload.is_test = true;
  }

  const { data: created, error } = await client
    .from(tableName)
    .insert(payload)
    .select(selectColumns)
    .single();

  if (error) {
    logger.error(`Failed to create ${entityType}`, {
      error,
      errorCode: error.code,
      errorMessage: error.message,
      errorDetails: error.details,
      userId,
      entityType,
    });
    throw error;
  }

  return created as T;
}

/**
 * Update an entity with ownership check via actor_id.
 *
 * Only updates the row if it belongs to the resolved actor.
 * Returns the updated row.
 */
export async function updateEntity<T = Record<string, unknown>>(
  entityType: EntityType,
  id: string,
  userId: string,
  data: Record<string, unknown>,
  options?: {
    /** Column to select after update (default: '*') */
    select?: string;
  }
): Promise<T> {
  const actor = await getOrCreateUserActor(userId);
  const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
  const tableName = getTableName(entityType);
  const selectColumns = options?.select ?? '*';

  const { data: updated, error } = await supabase
    .from(tableName)
    .update(data)
    .eq('id', id)
    .eq('actor_id', actor.id)
    .select(selectColumns)
    .single();

  if (error) {
    logger.error(`Failed to update ${entityType}`, {
      error,
      errorCode: error.code,
      errorMessage: error.message,
      id,
      userId,
      entityType,
    });
    throw error;
  }

  return updated as T;
}

/**
 * Delete an entity with ownership check via actor_id.
 *
 * Only deletes the row if it belongs to the resolved actor.
 */
export async function deleteEntity(
  entityType: EntityType,
  id: string,
  userId: string
): Promise<void> {
  const actor = await getOrCreateUserActor(userId);
  const supabase = await createServerClient();
  const tableName = getTableName(entityType);

  // One delete path for every entity table, so the table — and therefore the
  // set of known columns — is a runtime value.
  const { error } = await looseClient(supabase)
    .from(tableName)
    .delete()
    .eq('id', id)
    .eq('actor_id', actor.id);

  if (error) {
    logger.error(`Failed to delete ${entityType}`, {
      error,
      errorCode: error.code,
      errorMessage: error.message,
      id,
      userId,
      entityType,
    });
    throw error;
  }
}
