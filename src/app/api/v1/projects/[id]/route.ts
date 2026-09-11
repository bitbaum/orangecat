/**
 * Public API — GET + PATCH /api/v1/projects/[id]
 *
 * See /api/v1/README.md for the v1 contract.
 *
 * PATCH exists because publishing was one-way. FleetCrown could create a
 * project here (POST /api/v1/projects) and had no way to take it back down:
 * the status primitive lived only behind session auth at
 * /api/projects/[id]/status, which an integration holding an OAuth token or an
 * `ock_` key cannot call. So a project published from another product stayed
 * publicly visible for good — the operator's only recourse was to sign in here
 * and change it by hand.
 *
 * Deliberately narrow: status only. It is the field that decides public
 * visibility (`PROJECT_PUBLICLY_VISIBLE_STATUSES` mirrors the RLS policy), and
 * a general-purpose write surface is a much larger promise than "let the
 * publisher unpublish".
 *
 * The rules are the internal route's rules, not a second set: the same valid
 * statuses, the same allowed transitions, the same ownership check.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createEntityGetByIdHandler } from '@/lib/api/entityGetByIdHandler';
import { resolveRequestAuth, hasScope } from '@/lib/api/resolveRequestAuth';
import {
  apiError,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
  apiValidationError,
  handleSupabaseError,
} from '@/lib/api/standardResponse';
import {
  rateLimitIntegrationKeyWrite,
  rateLimitWriteAsync,
  retryAfterSeconds,
} from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { getTableName } from '@/config/entity-registry';
import { VALID_PROJECT_STATUSES, type ProjectStatus } from '@/config/project-statuses';
import { getAllowedStatusTransitions } from '@/config/entity-status';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { logger } from '@/utils/logger';

export const GET = createEntityGetByIdHandler({ entityType: 'project' });

const REQUIRED_SCOPE = 'project.write';
const bodySchema = z.object({ status: z.string().min(1) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await resolveRequestAuth(request);
  if (!auth || !auth.userId) {
    return apiError('Authentication required', 'UNAUTHORIZED', 401);
  }
  if (!hasScope(auth.scopes, REQUIRED_SCOPE)) {
    return apiError(`Missing required scope: ${REQUIRED_SCOPE}`, 'FORBIDDEN', 403);
  }

  // Same bucket split as the other v1 writers: per-key for integration keys so
  // one busy key cannot starve the user's others; per-user otherwise.
  const rl =
    auth.source === 'integration_key' && auth.integrationKeyId
      ? await rateLimitIntegrationKeyWrite(auth.integrationKeyId)
      : await rateLimitWriteAsync(auth.userId);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }

  const { id } = await context.params;
  const idValidation = getValidationError(validateUUID(id, 'project ID'));
  if (idValidation) {
    return idValidation;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return apiValidationError('Status is required');
  }
  const next = parsed.data.status.toLowerCase() as ProjectStatus;
  if (!VALID_PROJECT_STATUSES.includes(next)) {
    return apiValidationError(
      `Invalid status. Must be one of: ${VALID_PROJECT_STATUSES.join(', ')}`
    );
  }

  // A bearer caller carries no Supabase session, so a cookie client would run
  // as anon and RLS would hide the row. Ownership is enforced below in the app
  // layer instead — the pattern entityPostHandler documents and uses.
  const supabase = auth.source === 'session' ? await createServerClient() : createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from(getTableName('project'))
    .select('id, user_id, status')
    .eq('id', id)
    .single();
  if (fetchError || !existing) {
    return apiNotFound('Project not found');
  }
  if (existing.user_id !== auth.userId) {
    return apiError('You can only update your own projects', 'FORBIDDEN', 403);
  }

  const current = existing.status?.toLowerCase() as ProjectStatus;
  if (current === next) {
    // Idempotent on purpose: a publisher retrying an unpublish it already did
    // should not get an error that reads like a failure.
    return apiSuccess({ id, status: next, changed: false });
  }
  const allowed = getAllowedStatusTransitions(current) as ProjectStatus[];
  if (!allowed.includes(next)) {
    return apiValidationError(
      `Cannot transition from '${current}' to '${next}'. Allowed transitions: ${allowed.join(', ')}`
    );
  }

  const { error: updateError } = await supabase
    .from(getTableName('project'))
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (updateError) {
    return handleSupabaseError(updateError);
  }

  logger.info(
    `Project ${id} status changed from ${current} to ${next} via v1`,
    { userId: auth.userId, projectId: id, source: auth.source },
    'api/v1/projects'
  );
  return apiSuccess({ id, status: next, changed: true });
}
