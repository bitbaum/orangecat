/**
 * PATCH  /api/event-roles/[id] { status: 'open' | 'filled' | 'closed' }
 * DELETE /api/event-roles/[id]
 * Event owner only — RLS returns no row for anyone else, answered as 404.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAuthenticatedUserId } from '@/lib/api/authHelpers';
import { createServerClient } from '@/lib/supabase/server';
import { isRoleStatus } from '@/config/project-roles';
import { removeEventRole, setEventRoleStatus } from '@/domain/events/crew';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';

type Ctx = { params: Promise<{ id: string }> };

async function authorise() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return { response: apiError('Unauthorized', 'UNAUTHORIZED', 401) };
  }
  const rl = await rateLimitWriteAsync(userId);
  if (!rl.success) {
    return {
      response: apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl)),
    };
  }
  return { supabase: (await createServerClient()) as unknown as AnySupabaseClient };
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await authorise();
  if (!auth.supabase) {
    return auth.response;
  }
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (!isRoleStatus(body.status)) {
      return apiError('Invalid status', 'VALIDATION', 400);
    }
    const role = await setEventRoleStatus(auth.supabase, id, body.status);
    return role ? apiSuccess({ role }) : apiError('Role not found', 'NOT_FOUND', 404);
  } catch (error) {
    logger.error('Failed to update event role', error, 'EventRoles');
    return apiError('Failed to update the role', 'EVENT_ROLE_UPDATE_FAILED', 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const auth = await authorise();
  if (!auth.supabase) {
    return auth.response;
  }
  try {
    const { id } = await params;
    const removed = await removeEventRole(auth.supabase, id);
    return removed ? apiSuccess({ removed: true }) : apiError('Role not found', 'NOT_FOUND', 404);
  } catch (error) {
    logger.error('Failed to remove event role', error, 'EventRoles');
    return apiError('Failed to remove the role', 'EVENT_ROLE_DELETE_FAILED', 500);
  }
}
