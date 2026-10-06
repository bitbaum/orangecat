/**
 * GET /api/actors/:id/track-record — what OrangeCat observed about an actor's
 * deals, and the reviews both sides have let go public (ADR-0010).
 *
 * Public and identical for every caller: it reads through a sessionless
 * client, so a signed-in viewer never sees their own still-blind review
 * counted here. `null` data means the actor has no deals yet.
 */

import { apiSuccess, handleApiError } from '@/lib/api/standardResponse';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { getTrackRecord } from '@/domain/reputation/service';
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
