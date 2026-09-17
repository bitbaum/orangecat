/**
 * Entity Visibility Toggle API
 *
 * Toggle show_on_profile for entities.
 * Supports single item and bulk updates.
 *
 * PATCH /api/entities/[entityType]/visibility
 * Body: { ids: string[], show_on_profile: boolean }
 *
 * Last Modified: 2026-01-28
 * Last Modified Summary: Refactored to use withAuth middleware
 */

import { apiSuccess, apiError, apiBadRequest, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  isValidEntityType,
  getTableName,
  getUserIdField,
  EntityType,
} from '@/config/entity-registry';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import { logger } from '@/utils/logger';
import { z } from 'zod';

// Request body schema
const visibilityUpdateSchema = z.object({
  ids: z.array(z.string().guid()).min(1, 'At least one ID required'),
  show_on_profile: z.boolean(),
});

interface RouteContext {
  params: Promise<{ entityType: string }>;
}

export const PATCH = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  try {
    const { entityType } = await context.params;

    // Validate entity type
    if (!isValidEntityType(entityType)) {
      return apiBadRequest(`Invalid entity type: ${entityType}`);
    }

    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      const retryAfter = retryAfterSeconds(rl);
      return apiRateLimited('Too many requests. Please slow down.', retryAfter);
    }

    // Parse request body
    const body = await request.json();
    const parseResult = visibilityUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return apiBadRequest(parseResult.error.issues[0].message);
    }

    const { ids, show_on_profile } = parseResult.data;
    const tableName = getTableName(entityType as EntityType);
    const userIdField = getUserIdField(entityType as EntityType);

    // Resolve ownership value: actor_id fields need user→actor resolution
    const ownerValue =
      userIdField === 'actor_id' ? (await getOrCreateUserActor(user.id)).id : user.id;

    // Update entities - RLS ensures user can only update their own
    const { data, error } = await supabase
      .from(tableName)
      .update({ show_on_profile, updated_at: new Date().toISOString() })
      .in('id', ids)
      .eq(userIdField, ownerValue)
      .select('id');

    if (error) {
      logger.error('Failed to update entity visibility', {
        entityType,
        ids,
        error: error.message,
      });
      return apiError('Failed to update visibility');
    }

    const updatedCount = data?.length || 0;

    logger.info('Entity visibility updated', {
      entityType,
      userId: user.id,
      requestedCount: ids.length,
      updatedCount,
      show_on_profile,
    });

    return apiSuccess({
      message: `${updatedCount} ${entityType}${updatedCount !== 1 ? 's' : ''} ${show_on_profile ? 'shown on' : 'hidden from'} profile`,
      updatedCount,
      show_on_profile,
    });
  } catch (error) {
    logger.error('Unexpected error in visibility toggle', { error });
    return apiError('Failed to update visibility');
  }
});
