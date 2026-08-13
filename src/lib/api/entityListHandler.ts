/**
 * Generic Entity List Handler
 *
 * Provides reusable GET handler for entity list endpoints.
 * Handles pagination, filtering, draft visibility, and caching.
 *
 * Benefits:
 * - Eliminates duplication across entity list routes
 * - Consistent pagination and filtering
 * - Automatic draft visibility logic
 * - Consistent cache control
 * - Easy to add new entity types
 *
 * Created: 2025-01-28
 * Last Modified: 2026-01-06
 * Last Modified Summary: Added userIdField, publicFilters, requireAuth, selectColumns config options
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { looseClient } from '@/lib/supabase/untyped';
import {
  apiSuccess,
  apiForbidden,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitIntegrationKeyRead } from '@/lib/rate-limit';
import { compose } from '@/lib/api/compose';
import { withRateLimit } from '@/lib/api/withRateLimit';
import { withRequestId } from '@/lib/api/withRequestId';
import { getPagination, getString } from '@/lib/api/query';
import { logger } from '@/utils/logger';
import { type EntityType, getEntityMetadata, ENTITY_REGISTRY } from '@/config/entity-registry';
import { listEntitiesPage } from '@/domain/commerce/service';
import { getCacheControl, calculatePage } from './helpers';
import { shouldIncludeDrafts } from './authHelpers';
import { getUserActorId } from '@/domain/actors';
import { resolveRequestAuth, hasScope } from '@/lib/api/resolveRequestAuth';
import { PUBLIC_API_ENTITY_TYPES } from '@/config/public-api';

// ==================== TYPES ====================

interface EntityListHandlerConfig {
  /** Entity type from registry */
  entityType: EntityType;
  /** Override table name (uses registry tableName if not specified) */
  tableName?: string;
  /** Status values for public listings (default: ['active']) */
  publicStatuses?: string[];
  /** Status values for draft listings (default: includes 'draft') */
  draftStatuses?: string[];
  /** Default order field (default: 'created_at') */
  orderBy?: string;
  /** Order direction (default: 'desc') */
  orderDirection?: 'asc' | 'desc';
  /** Additional filters to apply (field -> value) */
  additionalFilters?: Record<string, string>;
  /** Whether to use listEntitiesPage helper (for commerce entities) */
  useListHelper?: boolean;
  /** Override ownership column (default: the entity's registry `userIdField`) */
  userIdField?: string;
  /** Additional filters for public listings (e.g., { is_public: true } for AI assistants) */
  publicFilters?: Record<string, unknown>;
  /** Whether authentication is required (default: false) */
  requireAuth?: boolean;
  /** Select specific columns (default: '*') */
  selectColumns?: string;
}

// ==================== HANDLER FACTORY ====================

/**
 * Creates a GET handler for entity list endpoints
 *
 * @example
 * ```typescript
 * export const GET = createEntityListHandler({
 *   entityType: 'product',
 *   useListHelper: true, // Uses listEntitiesPage for commerce entities
 * });
 * ```
 */
export function createEntityListHandler(config: EntityListHandlerConfig) {
  const {
    entityType,
    tableName,
    publicStatuses = ['active'],
    draftStatuses: _draftStatuses = ['draft', 'active'],
    orderBy = 'created_at',
    orderDirection = 'desc',
    additionalFilters = {},
    useListHelper = false,
    publicFilters = {},
    requireAuth = false,
    selectColumns = '*',
  } = config;

  const meta = getEntityMetadata(entityType);
  const table = tableName ?? meta.tableName;
  // Ownership column comes from the registry (the SSOT) unless overridden —
  // per-route literals drifted from the registry in the past
  const userIdField = config.userIdField ?? meta.userIdField;

  return compose(
    withRequestId(),
    withRateLimit('read')
  )(async (request: NextRequest) => {
    try {
      // This one handler serves every entity type: the table, the ownership
      // column and the configured filter columns are all runtime values.
      const supabase = looseClient(await createServerClient());
      const { limit, offset } = getPagination(request.url, { defaultLimit: 20, maxLimit: 100 });
      const category = getString(request.url, 'category');
      const queryUserId = getString(request.url, 'user_id');

      // Accept both session cookies AND integration keys (`X-OrangeCat-Key`).
      // Session: caller may pass `?user_id=` to scope to another profile;
      // integration key: the key is bound to one actor, so the bound actor
      // is the implicit (and only) scope — the query param is ignored.
      const auth = await resolveRequestAuth(request);
      const authenticatedUserId = auth?.userId ?? null;
      const boundActorId = auth?.boundActorId ?? null;
      const userId = boundActorId ? null : queryUserId;

      // Token scope check (integration key OR OIDC). Sessions always pass
      // (scopes=['*']). Anonymous reads also pass — public listings aren't gated.
      // Only an authenticated token with a narrowed scope can be denied here.
      if (
        (auth?.source === 'integration_key' || auth?.source === 'oidc') &&
        !hasScope(auth.scopes, `${entityType}.read`)
      ) {
        return apiForbidden(
          `This key is not allowed to read ${ENTITY_REGISTRY[entityType].namePlural.toLowerCase()}.`
        );
      }

      // Per-key read quota — stacks on top of the IP-based middleware so
      // one buggy integration can't starve siblings sharing an IP. The
      // 429 envelope matches the SDK's existing retry path.
      if (auth?.source === 'integration_key' && auth.integrationKeyId) {
        const rateLimit = await rateLimitIntegrationKeyRead(auth.integrationKeyId);
        if (!rateLimit.success) {
          const retryAfter = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
          logger.warn(`${entityType} read rate limit exceeded`, {
            integrationKeyId: auth.integrationKeyId,
          });
          return apiRateLimited(
            `Too many ${ENTITY_REGISTRY[entityType].namePlural.toLowerCase()} read requests. Please slow down.`,
            retryAfter
          );
        }
      }

      // If auth is required, check it first
      if (requireAuth && !authenticatedUserId) {
        return apiSuccess([], {
          page: calculatePage(offset, limit),
          limit,
          total: 0,
          headers: { 'Cache-Control': 'private, no-cache' },
        });
      }

      const includeOwnDrafts = await shouldIncludeDrafts(userId ?? null, authenticatedUserId);

      // Use listEntitiesPage helper for commerce entities
      // Derive commerce table names from entity registry (SSOT)
      const commerceEntityTypes: EntityType[] = ['product', 'service', 'cause'];
      const commerceTables = commerceEntityTypes.map(
        type => ENTITY_REGISTRY[type].tableName
      ) as readonly string[];

      // Integration-key auth bypasses the public-list commerce helper —
      // we want only the bound actor's rows, drafts included.
      if (!boundActorId && useListHelper && commerceTables.includes(table)) {
        const { items, total } = await listEntitiesPage(table, {
          limit,
          offset,
          category,
          userId,
          includeOwnDrafts,
        });

        return apiSuccess(items, {
          page: calculatePage(offset, limit),
          limit,
          total,
          headers: {
            'Cache-Control': getCacheControl(!!userId),
          },
        });
      }

      // Build custom query for entities that don't use listEntitiesPage
      let query = supabase.from(table).select(selectColumns, { count: 'exact' });

      // Sandbox isolation, scoped to entity types that got the is_test
      // column in migration 20260604000002 (the PUBLIC_API_ENTITY_TYPES
      // list). Sandbox integration keys see is_test=true rows; everyone
      // else (session, live integration key, anonymous) sees is_test=false.
      // Internal entity types (wallets, groups, ai_assistants, ...) don't
      // have the column so we skip the filter entirely for them.
      const hasIsTestColumn = (PUBLIC_API_ENTITY_TYPES as readonly string[]).includes(entityType);
      if (hasIsTestColumn) {
        const wantsTestData = auth?.source === 'integration_key' && auth.isTest;
        query = query.eq('is_test', wantsTestData);
      }

      // Integration-key auth: the key is bound to one actor, and that
      // actor is the implicit scope. Skip session-style resolution.
      if (boundActorId && userIdField === 'actor_id') {
        query = query.eq(userIdField, boundActorId);
      } else if (userId) {
        // When userIdField is 'actor_id', the query param is a user UUID
        // that needs to be resolved to an actor UUID first
        let filterValue = userId;
        if (userIdField === 'actor_id') {
          const actorId = await getUserActorId(supabase, userId);
          if (!actorId) {
            return apiSuccess([], {
              page: calculatePage(offset, limit),
              limit,
              total: 0,
              headers: { 'Cache-Control': getCacheControl(true) },
            });
          }
          filterValue = actorId;
        }
        query = query.eq(userIdField, filterValue);
        // For own items, only filter by status if includeOwnDrafts is false
        if (!includeOwnDrafts) {
          query = query.in('status', publicStatuses);
        }
      } else if (requireAuth && authenticatedUserId) {
        // For auth-required routes without user_id filter, show current user's items
        let filterValue = authenticatedUserId;
        if (userIdField === 'actor_id') {
          const actorId = await getUserActorId(supabase, authenticatedUserId);
          if (!actorId) {
            return apiSuccess([], {
              page: calculatePage(offset, limit),
              limit,
              total: 0,
              headers: { 'Cache-Control': 'private, no-cache' },
            });
          }
          filterValue = actorId;
        }
        query = query.eq(userIdField, filterValue);
      } else {
        // Public list: filter by public statuses only
        query = query.in('status', publicStatuses);

        // Apply public filters (e.g., is_public = true for AI assistants)
        for (const [field, value] of Object.entries(publicFilters)) {
          query = query.eq(field, value as string | number | boolean);
        }
      }

      // Apply standard filters
      if (category) {
        query = query.eq('category', category);
      }

      // Apply ordering (use nullsLast to handle NULL values gracefully)
      query = query.order(orderBy, { ascending: orderDirection === 'asc', nullsFirst: false });

      // Apply additional filters from config
      for (const [field, paramName] of Object.entries(additionalFilters)) {
        const value = getString(request.url, paramName);
        if (value) {
          query = query.eq(field, value);
        }
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: items, error, count } = await query;

      if (error) {
        logger.error(`Error fetching ${entityType}`, {
          error,
          table,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          userId,
          includeOwnDrafts,
        });
        // Return empty array instead of error to prevent 500 (similar to loans API)
        return apiSuccess([], {
          page: calculatePage(offset, limit),
          limit,
          total: 0,
          headers: {
            'Cache-Control': getCacheControl(!!userId),
          },
        });
      }

      return apiSuccess(items || [], {
        page: calculatePage(offset, limit),
        limit,
        total: count || 0,
        headers: {
          'Cache-Control': getCacheControl(!!userId),
        },
      });
    } catch (error) {
      return handleApiError(error);
    }
  });
}
