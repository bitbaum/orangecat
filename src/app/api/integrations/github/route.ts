/**
 * DELETE /api/integrations/github — disconnect GitHub from Cat.
 *
 * Forgets the stored tokens. (The person can also revoke the app on GitHub;
 * either side ending it is enough, and the next read simply finds nothing.)
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiRateLimited, apiSuccess, handleApiError } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import { deleteGitHubConnection } from '@/services/github/connection';

export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  const rl = await rateLimitWriteAsync(request.user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }
  try {
    await deleteGitHubConnection(getAdminClient(), request.user.id);
    return apiSuccess({ disconnected: true });
  } catch (error) {
    return handleApiError(error);
  }
});
