/**
 * Unified Groups API Route
 *
 * Handles CRUD operations for groups (circles + organizations).
 * Uses unified GroupsService.
 *
 * Created: 2025-01-30
 * Last Modified: 2026-01-28
 * Last Modified Summary: Public reads with optional auth; writes remain authenticated
 */

import { createGroupSchema } from '@/services/groups/validation';
import { logger } from '@/utils/logger';
import { withAuth, withOptionalAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import type { CreateGroupInput } from '@/types/group';
import {
  apiSuccess,
  apiCreated,
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAvailableGroups, getUserGroups } from '@/services/groups/queries/groups';

export const GET = withOptionalAuth(async request => {
  try {
    const { user, supabase } = request;

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // 'circle', 'organization', etc.
    const category = searchParams.get('category');
    const publicScope = searchParams.get('scope') === 'public';
    const page = parseInt(searchParams.get('page') || '1');
    // Accept both 'pageSize' and 'limit' for backward compatibility
    const pageSize = parseInt(searchParams.get('pageSize') || searchParams.get('limit') || '20');

    // Build query filters
    const query = {
      ...(type && { type }),
      ...(category && { category }),
    };

    // Pass the server-side supabase client so auth works in API route context
    // Discovery is public, while a signed-in dashboard needs the member list.
    // Keep both consumers on one endpoint and never make fixture discovery run
    // a client page just to recover a public group slug.
    const userGroupsResult = user && !publicScope
      ? await getUserGroups(query, { page, pageSize }, supabase)
      : await getAvailableGroups(
          { ...query, is_public: true },
          { page, pageSize },
          supabase
        );

    if (!userGroupsResult.success) {
      return apiInternalError(userGroupsResult.error || 'Failed to fetch groups');
    }

    return apiSuccess({
      groups: userGroupsResult.groups || [],
      total: userGroupsResult.total || 0,
    });
  } catch (error) {
    logger.error('Error in GET /api/groups:', error);
    return apiInternalError('Internal server error');
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      const retryAfter = retryAfterSeconds(rl);
      return apiRateLimited('Too many group creation requests. Please slow down.', retryAfter);
    }

    const body = await request.json();

    // Validate request
    const validationResult = createGroupSchema.safeParse(body);
    if (!validationResult.success) {
      return apiBadRequest('Invalid request', validationResult.error.errors);
    }

    // Create group using server client
    const { createGroup } = await import('@/services/groups/mutations/groups');
    const result = await createGroup(validationResult.data as CreateGroupInput, supabase, user.id);

    if (!result.success) {
      return apiInternalError(result.error || 'Failed to create group');
    }

    // Standard entity shape: apiCreated already wraps in `data`, so pass
    // the group itself. (The old `{ data, group }` double-wrap made
    // `result.data.id`/`result.data.slug` undefined in EntityForm, which
    // broke the post-create redirect.)
    return apiCreated(result.group);
  } catch (error) {
    logger.error('Error in POST /api/groups:', error);
    return apiInternalError('Internal server error');
  }
});
