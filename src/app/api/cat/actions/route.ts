/**
 * My Cat Actions API
 *
 * Endpoints for managing pending actions and action history.
 *
 * GET /api/cat/actions - Get pending actions and recent history
 * POST /api/cat/actions - Execute an action directly (requires permission)
 *
 * Created: 2026-01-21
 * Last Modified: 2026-01-21
 * Last Modified Summary: Initial implementation
 */

import { NextRequest } from 'next/server';
import { createActionExecutor } from '@/services/cat';
import { z } from 'zod';
import { logger } from '@/utils/logger';
import {
  apiSuccess,
  apiBadRequest,
  apiForbidden,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/constants/pagination';
import { apiErrorMessage } from '@/lib/api/errorMessage';

// Validation schema
const executeActionSchema = z.object({
  actionId: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()),
  conversationId: z.string().guid().optional(),
  messageId: z.string().guid().optional(),
});

/**
 * GET /api/cat/actions
 * Get pending actions and recent action history
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10))
    );
    const actionId = searchParams.get('actionId') || undefined;
    const status = searchParams.get('status') || undefined;

    const executor = createActionExecutor(supabase);

    // Get pending actions and history in parallel
    const [pendingActions, history] = await Promise.all([
      executor.getPendingActions(user.id),
      executor.getActionHistory(user.id, { limit, actionId, status }),
    ]);

    return apiSuccess({ pendingActions, history });
  } catch (error) {
    logger.error('Get cat actions error', error, 'CatActionsAPI');
    return apiInternalError('Failed to get actions');
  }
});

/**
 * POST /api/cat/actions
 * Execute an action directly (requires permission)
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      const retryAfter = retryAfterSeconds(rl);
      return apiRateLimited('Too many requests. Please slow down.', retryAfter);
    }

    const body = await (request as NextRequest).json();
    const parseResult = executeActionSchema.safeParse(body);

    if (!parseResult.success) {
      return apiBadRequest('Invalid request', parseResult.error.issues);
    }

    // A signed-in person is about to ACT, so mint their actor if they somehow
    // have none. Creating an entity already did this lazily, so the same user
    // could create a project and yet be 404'd here — same account, same missing
    // row, opposite answer. This is that lazy creation made consistent, not a
    // new capability.
    const { id: actorId } = await getOrCreateUserActor(user.id);

    const executor = createActionExecutor(supabase);
    const result = await executor.executeAction(user.id, actorId, parseResult.data);

    if (result.success) {
      return apiSuccess(result);
    } else if (result.status === 'denied') {
      // Denial reasons come from the permission service and are derived from
      // the user's own settings ("exceeds your per-action cap of X BTC", "daily
      // limit reached") — surfacing them is what makes caps actionable.
      return apiForbidden(apiErrorMessage(result, 'Action not permitted'));
    } else {
      return apiBadRequest('Action could not be executed');
    }
  } catch (error) {
    logger.error('Execute cat action error', error, 'CatActionsAPI');
    return apiInternalError('Failed to execute action');
  }
});
