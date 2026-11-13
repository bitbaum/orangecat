/**
 * DELETE /api/integrations/google — disconnect the Google account.
 *
 * Forgets the stored tokens and asks Google to cancel them. (The person can
 * also remove the app in their Google account; either side ending it is
 * enough, and the next read simply finds nothing.)
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiRateLimited, apiSuccess, handleApiError } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import { deleteGoogleConnection } from '@/services/google/connection';

export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  const rl = await rateLimitWriteAsync(request.user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }
  try {
    await deleteGoogleConnection(getAdminClient(), request.user.id);
    return apiSuccess({ disconnected: true });
  } catch (error) {
    return handleApiError(error);
  }
});
