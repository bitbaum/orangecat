/**
 * Group Members API Route
 *
 * Handles member operations for a group.
 * Uses unified GroupsService.
 *
 * Created: 2025-01-30
 * Last Modified: 2026-07-04
 * Last Modified Summary: Fix getGroup lookup — use isBySlug + server Supabase client (WF-009)
 */

import { withAuth, withOptionalAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { createServerClient } from '@/lib/supabase/server';
import groupsService from '@/services/groups';
import { logger } from '@/utils/logger';
import {
  apiSuccess,
  apiCreated,
  apiNotFound,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { recordGroupActivity } from '@/services/groups/activities';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isBySlug = (identifier: string) => !UUID_PATTERN.test(identifier);

export const GET = withOptionalAuth(async (_request, context: RouteContext) => {
  try {
    const { slug } = await context.params;
    const supabase = await createServerClient();

    // Get group first — must pass server client (browser client fails in API routes)
    const groupResult = await groupsService.getGroup(slug, isBySlug(slug), supabase);
    if (!groupResult.success || !groupResult.group) {
      return apiNotFound('Group not found');
    }

    // Get members — pass the server client so auth/queries work in API route context
    const membersResult = await groupsService.getGroupMembers(
      groupResult.group.id,
      undefined,
      supabase
    );

    if (!membersResult.success) {
      return apiInternalError(apiErrorMessage(membersResult, 'Failed to fetch members'));
    }

    return apiSuccess({
      members: membersResult.members || [],
      total: membersResult.total || 0,
    });
  } catch (error) {
    logger.error('Error in GET /api/groups/[slug]/members:', error);
    return apiInternalError('Internal server error');
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  try {
    const { slug } = await context.params;
    const { user } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      const retryAfter = retryAfterSeconds(rl);
      return apiRateLimited('Too many requests. Please slow down.', retryAfter);
    }

    const supabase = request.supabase;

    // Get group first
    const groupResult = await groupsService.getGroup(slug, isBySlug(slug), supabase);
    if (!groupResult.success || !groupResult.group) {
      return apiNotFound('Group not found');
    }

    // Join group — pass the authed server client so RLS/auth resolve correctly
    const result = await groupsService.joinGroup(groupResult.group.id, supabase);

    if (!result.success) {
      return apiInternalError(apiErrorMessage(result, 'Failed to join group'));
    }

    // Await so the activity write completes (and errors surface) before responding.
    try {
      await recordGroupActivity(request.supabase, {
        group_id: groupResult.group.id,
        user_id: user.id,
        activity_type: 'joined_group',
        metadata: { group_name: groupResult.group.name },
      });
    } catch (activityError) {
      logger.error('Failed to record join activity', activityError);
    }

    return apiCreated({ success: true, message: 'Successfully joined group' });
  } catch (error) {
    logger.error('Error in POST /api/groups/[slug]/members:', error);
    return apiInternalError('Internal server error');
  }
});
