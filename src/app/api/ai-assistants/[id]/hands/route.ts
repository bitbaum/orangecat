/**
 * A bot's hands, switched by its owner: off, ask first, or on its own.
 *
 * GET /api/ai-assistants/[id]/hands — every hand with its setting for this bot
 * PUT /api/ai-assistants/[id]/hands — set one: { actionId, mode }
 *
 * Owner only. "On its own" for a high-risk hand needs the permission the
 * owner already holds for their Cat: a switch here never unlocks it.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiInternalError,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getValidationError, validateUUID } from '@/lib/api/validation';
import { CAT_ACTIONS } from '@/config/cat-actions';
import { DATABASE_TABLES } from '@/config/database-tables';
import { canGrantOnConfirm } from '@/services/cat/action-types';
import { CatPermissionService } from '@/services/cat/permission-service';
import {
  HAND_MODES,
  getHandGrants,
  handMode,
  isHand,
  setHandGrant,
} from '@/services/companions/hand-grants';
import { handRows } from '@/services/companions/hand-rows';
import { logger } from '@/utils/logger';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  actionId: z.string().trim().min(1).max(80).refine(isHand, 'Not a hand a bot can have'),
  mode: z.enum(HAND_MODES),
});

async function ownBot(request: AuthenticatedRequest, id: string): Promise<boolean> {
  const { data } = await request.supabase
    .from(DATABASE_TABLES.AI_ASSISTANTS)
    .select('id')
    .eq('id', id)
    .eq('user_id', request.user.id)
    .maybeSingle();
  return Boolean(data);
}

async function rowsFor(request: AuthenticatedRequest, id: string) {
  const permissions = new CatPermissionService(request.supabase);
  const [grants, stored] = await Promise.all([
    getHandGrants(request.supabase, request.user.id, id),
    permissions.getUserPermissions(request.user.id),
  ]);
  const held = new Set<string>();
  for (const row of handRows(grants)) {
    const check = await permissions.checkPermission(request.user.id, row.id, stored);
    if (check.allowed || canGrantOnConfirm(CAT_ACTIONS[row.id], check.code)) {
      held.add(row.id);
    }
  }
  return handRows(grants, held);
}

export const GET = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'assistant ID'));
  if (invalid) {
    return invalid;
  }
  try {
    if (!(await ownBot(request, id))) {
      return apiNotFound('Bot not found');
    }
    return apiSuccess({ hands: await rowsFor(request, id) });
  } catch (error) {
    logger.error('hands load failed', error, 'CompanionHandsAPI');
    return apiInternalError('Failed to load what this bot can do');
  }
});

export const PUT = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'assistant ID'));
  if (invalid) {
    return invalid;
  }
  try {
    const rl = await rateLimitWriteAsync(request.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const parsed = bodySchema.safeParse(await (request as NextRequest).json());
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid request data');
    }
    if (!(await ownBot(request, id))) {
      return apiNotFound('Bot not found');
    }
    const { actionId, mode } = parsed.data;
    if (mode === 'auto') {
      const rows = await rowsFor(request, id);
      const row = rows.find(r => r.id === actionId);
      if (!row?.canAuto) {
        return apiBadRequest('This one makes something on OrangeCat, so it always asks you first.');
      }
      if (!row.available) {
        return apiBadRequest(
          'This one starts work in your projects, so it needs the permission you give your Cat first. Allow it there, then switch it on here.'
        );
      }
    }
    await setHandGrant(request.supabase, request.user.id, id, actionId, mode);
    const hands = await rowsFor(request, id);
    // Read back, not assumed: the switch shows what was stored.
    const grants = await getHandGrants(request.supabase, request.user.id, id);
    if (handMode(grants, actionId) !== mode) {
      return apiInternalError('That did not save. Try again.');
    }
    return apiSuccess({ hands });
  } catch (error) {
    logger.error('hands save failed', error, 'CompanionHandsAPI');
    return apiInternalError('That did not save. Try again.');
  }
});
