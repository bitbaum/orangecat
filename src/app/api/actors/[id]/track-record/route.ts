/**
 * GET /api/actors/:id/track-record — a seller's public track record (ADR-0010):
 * deal and customer counts, outcomes, and the reviews their customers let go
 * public. Never sales volume, never what anyone bought, never a reviewer who
 * did not choose to be named; the database functions decide that.
 *
 * `null` data means the actor has sold nothing yet.
 */

import { apiSuccess, handleApiError } from '@/lib/api/standardResponse';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { getTrackRecord } from '@/domain/reputation/track-record';
import { createPublicClient } from '@/lib/supabase/public';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'actor ID'));
  if (invalid) {
    return invalid;
  }
  try {
    return apiSuccess({ trackRecord: await getTrackRecord(createPublicClient(), id) });
  } catch (error) {
    return handleApiError(error);
  }
}
