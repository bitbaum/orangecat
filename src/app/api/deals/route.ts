/**
 * GET /api/deals — every deal the signed-in person is a party to, with where
 * each review stands (ADR-0010).
 *
 * Thin: the shape lives in @/domain/reputation/service; RLS returns only the
 * caller's own deals and keeps the other side's review hidden until reveal.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess, handleApiError } from '@/lib/api/standardResponse';
import { getUserActorIds } from '@/domain/actors';
import { listMyDeals } from '@/domain/reputation/service';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const actorIds = await getUserActorIds(supabase, user.id);
    return apiSuccess({ deals: await listMyDeals(supabase, actorIds) });
  } catch (error) {
    return handleApiError(error);
  }
});
