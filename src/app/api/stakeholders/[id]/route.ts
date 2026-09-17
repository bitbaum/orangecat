/**
 * Single Stakeholder Relationship API
 *
 * PATCH  /api/stakeholders/[id] — update status / confidence / notes / metadata.
 * DELETE /api/stakeholders/[id] — drop the edge.
 *
 * Both routes rely on RLS for authorisation — the caller can only
 * touch rows whose owner_actor_id maps to their auth.uid().
 */

import { z } from 'zod';
import { DATABASE_TABLES } from '@/config/database-tables';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiNoContent,
  apiBadRequest,
  apiValidationError,
  apiNotFound,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { logger } from '@/utils/logger';

const patchSchema = z
  .object({
    status: z.string().max(50).nullable().optional(),
    confidence: z.number().int().min(0).max(100).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    data =>
      data.status !== undefined ||
      data.confidence !== undefined ||
      data.notes !== undefined ||
      data.metadata !== undefined,
    {
      message: 'At least one field (status, confidence, notes, metadata) must be provided',
    }
  );

export const PATCH = withAuth(async (request: AuthenticatedRequest, context: unknown) => {
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const { params } = context as { params: Promise<{ id: string }> };
    const { id } = await params;

    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return apiBadRequest('Invalid id');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiBadRequest('Invalid JSON body');
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError('Invalid request', parsed.error.flatten());
    }

    // Only set keys the caller provided (don't overwrite with undefined).
    const updates: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) {
      updates.status = parsed.data.status;
    }
    if (parsed.data.confidence !== undefined) {
      updates.confidence = parsed.data.confidence;
    }
    if (parsed.data.notes !== undefined) {
      updates.notes = parsed.data.notes;
    }
    if (parsed.data.metadata !== undefined) {
      updates.metadata = parsed.data.metadata;
    }

    const { data, error } = await supabase
      .from(DATABASE_TABLES.STAKEHOLDER_RELATIONSHIPS)
      .update(updates)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      logger.error('Failed to patch stakeholder relationship', error, 'StakeholdersAPI');
      return apiInternalError('Failed to update relationship');
    }
    if (!data) {
      // Either not found or RLS blocked. Same response either way to
      // avoid leaking whether the row exists.
      return apiNotFound('Stakeholder relationship not found');
    }

    return apiSuccess({ relationship: data });
  } catch (error) {
    logger.error('Unexpected error in PATCH /api/stakeholders/[id]', error, 'StakeholdersAPI');
    return apiInternalError('Internal server error');
  }
});

export const DELETE = withAuth(async (request: AuthenticatedRequest, context: unknown) => {
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const { params } = context as { params: Promise<{ id: string }> };
    const { id } = await params;

    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return apiBadRequest('Invalid id');
    }

    // Verify the row exists + is visible under RLS before delete so we
    // can return a meaningful 404 instead of a silent 0-rows-affected.
    const { data: existing, error: existingErr } = await supabase
      .from(DATABASE_TABLES.STAKEHOLDER_RELATIONSHIPS)
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (existingErr) {
      logger.error('Failed to look up stakeholder relationship', existingErr, 'StakeholdersAPI');
      return apiInternalError('Failed to delete relationship');
    }
    if (!existing) {
      return apiNotFound('Stakeholder relationship not found');
    }

    const { error } = await supabase
      .from(DATABASE_TABLES.STAKEHOLDER_RELATIONSHIPS)
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Failed to delete stakeholder relationship', error, 'StakeholdersAPI');
      return apiInternalError('Failed to delete relationship');
    }

    return apiNoContent();
  } catch (error) {
    logger.error('Unexpected error in DELETE /api/stakeholders/[id]', error, 'StakeholdersAPI');
    return apiInternalError('Internal server error');
  }
});
