/**
 * My Cat Permissions API
 *
 * GET    /api/cat/permissions - Get user's permission summary
 * POST   /api/cat/permissions - Grant permission for an action/category
 * DELETE /api/cat/permissions - Revoke permission for an action/category
 */

import { NextRequest } from 'next/server';
import { createPermissionService } from '@/services/cat';
import { defaultAllowedFor } from '@/services/cat/permission-service';
import {
  CAT_ACTIONS,
  ACTION_CATEGORIES,
  ACTION_CATEGORY_KEYS,
  type ActionCategory,
} from '@/config/cat-actions';
import { toAutonomyLevel } from '@/config/cat-autonomy';
import { z } from 'zod';
import { logger } from '@/utils/logger';
import {
  apiSuccess,
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';

const categorySchema = z.enum(ACTION_CATEGORY_KEYS);

const grantPermissionSchema = z.object({
  actionId: z.string().min(1),
  category: categorySchema,
  requiresConfirmation: z.boolean().optional(),
  // Limits/caps: omitted = leave unchanged, null = clear. BTC decimals, not sats.
  dailyLimit: z.number().int().positive().nullable().optional(),
  maxBtcPerAction: z.number().positive().nullable().optional(),
  maxBtcPerDay: z.number().positive().nullable().optional(),
});

const revokePermissionSchema = z.object({
  actionId: z.string().min(1),
  category: categorySchema,
});

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const permissionService = createPermissionService(supabase);
    const summary = await permissionService.getPermissionSummary(user.id);

    // Resolve each action's EFFECTIVE autonomy level the same way the executor
    // does (specific row → category row → registry default), so the settings
    // screen shows what will actually happen, not the shipped defaults.
    const stored = await permissionService.getUserPermissions(user.id);
    const byAction = new Map(stored.filter(p => p.action_id !== '*').map(p => [p.action_id, p]));
    const byCategory = new Map(
      stored.filter(p => p.action_id === '*').map(p => [p.category as string, p])
    );

    const availableActions = Object.values(CAT_ACTIONS)
      .filter(a => a.enabled)
      .map(a => {
        const row = byAction.get(a.id) ?? byCategory.get(a.category);
        const autonomy = row
          ? toAutonomyLevel(row.granted, row.requires_confirmation)
          : toAutonomyLevel(defaultAllowedFor(a.id, a.category), a.requiresConfirmation);
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          category: a.category,
          riskLevel: a.riskLevel,
          requiresConfirmation: a.requiresConfirmation,
          autonomy,
        };
      });
    const categories = Object.entries(ACTION_CATEGORIES).map(([key, value]) => ({
      id: key,
      ...value,
    }));

    const spendCaps = await permissionService.getSpendCaps(user.id);

    return apiSuccess({ summary, availableActions, categories, spendCaps });
  } catch (error) {
    logger.error('Get cat permissions error', error, 'CatPermissionsAPI');
    return apiInternalError('Failed to get permissions');
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const body = await (request as NextRequest).json();
    const parseResult = grantPermissionSchema.safeParse(body);
    if (!parseResult.success) {
      return apiBadRequest('Invalid request', parseResult.error.issues);
    }

    const { actionId, category, requiresConfirmation, ...rawLimits } = parseResult.data;

    const action = actionId === '*' ? null : CAT_ACTIONS[actionId];
    if (actionId !== '*') {
      if (!action) {
        return apiBadRequest(`Unknown action: ${actionId}`);
      }
      if (action.category !== category) {
        return apiBadRequest(`Action ${actionId} is not in category ${category}`);
      }
    }

    // Preserve omitted-vs-null semantics: only forward keys the client sent.
    const limits: {
      dailyLimit?: number | null;
      maxBtcPerAction?: number | null;
      maxBtcPerDay?: number | null;
    } = {};
    if ('dailyLimit' in body) {
      limits.dailyLimit = rawLimits.dailyLimit ?? null;
    }
    if ('maxBtcPerAction' in body) {
      limits.maxBtcPerAction = rawLimits.maxBtcPerAction ?? null;
    }
    if ('maxBtcPerDay' in body) {
      limits.maxBtcPerDay = rawLimits.maxBtcPerDay ?? null;
    }

    // High-risk actions (money, public posting) can never be set to run
    // unconfirmed — the UI hides "Automatic" for them, and this is the
    // server-side guarantee behind that promise.
    const effectiveConfirmation =
      action?.riskLevel === 'high' ? true : (requiresConfirmation ?? true);

    const permissionService = createPermissionService(supabase);
    if (actionId === '*') {
      await permissionService.grantCategory(user.id, category as ActionCategory, {
        requiresConfirmation: effectiveConfirmation,
        ...limits,
      });
    } else {
      await permissionService.grantPermission(user.id, actionId, category as ActionCategory, {
        requiresConfirmation: effectiveConfirmation,
        ...limits,
      });
    }

    return apiSuccess({
      summary: await permissionService.getPermissionSummary(user.id),
      spendCaps: await permissionService.getSpendCaps(user.id),
    });
  } catch (error) {
    logger.error('Grant cat permission error', error, 'CatPermissionsAPI');
    return apiInternalError('Failed to grant permission');
  }
});

export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const body = await (request as NextRequest).json();
    const parseResult = revokePermissionSchema.safeParse(body);
    if (!parseResult.success) {
      return apiBadRequest('Invalid request', parseResult.error.issues);
    }

    const { actionId, category } = parseResult.data;
    const permissionService = createPermissionService(supabase);

    if (actionId === '*') {
      await permissionService.revokeCategory(user.id, category as ActionCategory);
    } else {
      await permissionService.revokePermission(user.id, actionId, category as ActionCategory);
    }

    return apiSuccess({ summary: await permissionService.getPermissionSummary(user.id) });
  } catch (error) {
    logger.error('Revoke cat permission error', error, 'CatPermissionsAPI');
    return apiInternalError('Failed to revoke permission');
  }
});
