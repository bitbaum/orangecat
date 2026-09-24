/**
 * My Cat — Connections
 *
 * GET /api/cat/connections — every system Cat is connected to (the list is
 * config/cat-connections) with this user's status for each.
 */

import { apiSuccess, handleApiError } from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { getCatConnectionStatuses } from '@/services/cat/connections';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const connections = await getCatConnectionStatuses(supabase, user.id);
    return apiSuccess({ connections });
  } catch (error) {
    return handleApiError(error);
  }
});
