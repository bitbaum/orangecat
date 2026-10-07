/**
 * PATCH  /api/event-roles/[id] { status } | { assign: '@username' } | { unassign: userId } | { fee_amount }
 * DELETE /api/event-roles/[id]
 * Event owner only — RLS returns no row for anyone else, answered as 404.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAuthenticatedUserId } from '@/lib/api/authHelpers';
import { createServerClient } from '@/lib/supabase/server';
import { isRoleStatus } from '@/config/project-roles';
import {
  CrewAssignError,
  assignToRole,
  removeEventRole,
  setEventRoleStatus,
  setRoleFee,
  unassignFromRole,
} from '@/domain/events/crew';
import { notifyCrewAssigned } from '@/domain/events/notify';
import { DATABASE_TABLES } from '@/config/database-tables';
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

    // Put someone on the crew: { assign: "@username" }
    if (typeof body.assign === 'string') {
      const username = body.assign.trim().replace(/^@/, '').toLowerCase();
      const { data: person } = await auth.supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('id')
        .eq('username', username)
        .maybeSingle();
      if (!person) {
        return apiError(`No one on OrangeCat is called @${username}`, 'NOT_FOUND', 404);
      }
      const role = await assignToRole(auth.supabase, id, person.id as string);
      void notifyCrewAssigned({
        eventId: role.event_id,
        userId: person.id as string,
        roleTitle: role.role_title,
        checksIn: role.can_check_in,
      });
      return apiSuccess({ role });
    }

    // The fee for one person in the role, in the event's currency: { fee_amount }
    if ('fee_amount' in body) {
      const fee =
        body.fee_amount === null || body.fee_amount === '' ? null : Number(body.fee_amount);
      if (fee !== null && !(Number.isFinite(fee) && fee >= 0)) {
        return apiError('A fee is a number, zero or more', 'VALIDATION', 400);
      }
      return apiSuccess({ role: await setRoleFee(auth.supabase, id, fee) });
    }

    // Take someone off: { unassign: "<user id>" }
    if (typeof body.unassign === 'string') {
      return apiSuccess({ role: await unassignFromRole(auth.supabase, id, body.unassign) });
    }

    if (!isRoleStatus(body.status)) {
      return apiError('Invalid status', 'VALIDATION', 400);
    }
    const role = await setEventRoleStatus(auth.supabase, id, body.status);
    return role ? apiSuccess({ role }) : apiError('Role not found', 'NOT_FOUND', 404);
  } catch (error) {
    if (error instanceof CrewAssignError) {
      return apiError(error.message, 'CREW', 409);
    }
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
