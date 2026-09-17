/**
 * Unified Group Detail API Route
 *
 * Handles GET, PUT, DELETE operations for a specific group by slug.
 * Uses unified GroupsService.
 *
 * Created: 2025-01-30
 * Last Modified: 2026-01-28
 * Last Modified Summary: Refactored PUT/DELETE to use withAuth middleware
 */

import { NextRequest } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { createServerClient } from '@/lib/supabase/server';
import groupsService from '@/services/groups';
import { updateGroupSchema } from '@/services/groups/validation';
import { logger } from '@/utils/logger';
import type { UpdateGroupInput } from '@/types/group';
import {
  apiSuccess,
  apiNotFound,
  apiBadRequest,
  apiForbidden,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// The segment accepts either a slug or a UUID id. The generic entity edit
// flow (`createPath?edit=<id>` → GET/PUT `${apiEndpoint}/${id}`) addresses
// groups by id like every other entity; human-facing URLs use the slug.
// Slugs are never UUID-shaped, so the two are unambiguous.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isBySlug = (identifier: string) => !UUID_PATTERN.test(identifier);

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;

    // Pass a server client — without it the service falls back to the browser client,
    // whose auth.getUser()/queries fail server-side and 500 this public endpoint.
    const supabase = await createServerClient();

    const result = await groupsService.getGroup(slug, isBySlug(slug), supabase);

    if (!result.success) {
      if (result.error?.includes('not found')) {
        return apiNotFound('Group not found');
      }
      return apiInternalError(apiErrorMessage(result, 'Failed to fetch group'));
    }

    // Standard entity shape: `data` IS the group — consumed by the generic
    // edit flow (useEntityCreateEdit). Don't re-wrap as `{ group }`.
    return apiSuccess(result.group);
  } catch (error) {
    logger.error('Error in GET /api/groups/[slug]:', error);
    return apiInternalError();
  }
}

export const PUT = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  try {
    const { user } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      const retryAfter = retryAfterSeconds(rl);
      return apiRateLimited('Too many requests. Please slow down.', retryAfter);
    }

    const { slug } = await context.params;
    const body = await request.json();

    // Validate request
    const validationResult = updateGroupSchema.safeParse(body);
    if (!validationResult.success) {
      return apiBadRequest('Invalid request', validationResult.error.issues);
    }

    // Get group first to check permissions (use the authenticated server client)
    const groupResult = await groupsService.getGroup(slug, isBySlug(slug), request.supabase);
    if (!groupResult.success || !groupResult.group) {
      return apiNotFound('Group not found');
    }

    // Check if user has permission to update
    const canUpdate = await groupsService.checkGroupPermission(
      groupResult.group.id,
      user.id,
      'canManageSettings',
      request.supabase
    );

    if (!canUpdate) {
      return apiForbidden('You do not have permission to update this group');
    }

    // Update group
    const result = await groupsService.updateGroup(
      groupResult.group.id,
      validationResult.data as UpdateGroupInput
    );

    if (!result.success) {
      return apiInternalError(apiErrorMessage(result, 'Failed to update group'));
    }

    // Standard entity shape: `data` IS the group — the generic edit form
    // reads `data.slug` to build its success redirect.
    return apiSuccess(result.group);
  } catch (error) {
    logger.error('Error in PUT /api/groups/[slug]:', error);
    return apiInternalError();
  }
});

export const DELETE = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  try {
    const { user } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      const retryAfter = retryAfterSeconds(rl);
      return apiRateLimited('Too many requests. Please slow down.', retryAfter);
    }

    const { slug } = await context.params;

    // Get group first to check permissions (use the authenticated server client)
    const groupResult = await groupsService.getGroup(slug, isBySlug(slug), request.supabase);
    if (!groupResult.success || !groupResult.group) {
      return apiNotFound('Group not found');
    }

    // Check if user is owner
    if (groupResult.group.created_by !== user.id) {
      return apiForbidden('Only the owner can delete this group');
    }

    // Delete group
    const result = await groupsService.deleteGroup(groupResult.group.id);

    if (!result.success) {
      return apiInternalError(apiErrorMessage(result, 'Failed to delete group'));
    }

    return apiSuccess({ success: true });
  } catch (error) {
    logger.error('Error in DELETE /api/groups/[slug]:', error);
    return apiInternalError();
  }
});
