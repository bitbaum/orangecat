/**
 * The crew an event needs.
 *
 * GET  /api/events/[id]/roles              — its roles (readable when the event is)
 * POST /api/events/[id]/roles { crew: [] } — add roles, written the way people
 *      say them ("2 bartenders", "DJ"). Owner only; RLS enforces it.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiRateLimited } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAuthenticatedUserId } from '@/lib/api/authHelpers';
import { createServerClient } from '@/lib/supabase/server';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { parseCrewRoles } from '@/config/event-crew';
import { addEventRoles, listEventRoles } from '@/domain/events/crew';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
    return apiSuccess({ roles: await listEventRoles(supabase, id) });
  } catch (error) {
    logger.error('Failed to list event roles', error, 'EventRoles');
    return apiError('Failed to load the crew', 'EVENT_ROLES_LIST_FAILED', 500);
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return apiError('Unauthorized', 'UNAUTHORIZED', 401);
  }
  const rl = await rateLimitWriteAsync(userId);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const crew = parseCrewRoles(body.crew);
    if (crew.length === 0) {
      return apiError('Say who you need, e.g. "2 bartenders"', 'VALIDATION', 400);
    }
    const supabase = (await createServerClient()) as unknown as AnySupabaseClient;
    // A clean 403 instead of an RLS error string: is this the caller's event?
    const { data: event } = await supabase
      .from(ENTITY_REGISTRY.event.tableName)
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();
    if (!event) {
      return apiError('Event not found', 'NOT_FOUND', 404);
    }
    if (event.user_id !== userId) {
      return apiError('Only the organizer can add crew roles', 'FORBIDDEN', 403);
    }
    const roles = await addEventRoles(supabase, id, crew);
    return apiSuccess({ roles }, { status: 201 });
  } catch (error) {
    logger.error('Failed to add event roles', error, 'EventRoles');
    return apiError('Failed to add the crew', 'EVENT_ROLES_CREATE_FAILED', 500);
  }
}
