/**
 * Cat Quota
 *
 * Authenticated endpoint that reports the user's current Cat usage budget
 * so the UI can surface "N messages left today" + an upgrade CTA before
 * the request actually 429s.
 *
 * The read lives in services/cat/quota.ts so /api/cat/usage computes its
 * sentences from the very same numbers this meter shows.
 *
 * GET /api/cat/quota
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/standardResponse';
import { readCatQuota } from '@/services/cat/quota';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  return apiSuccess(await readCatQuota(request.supabase, request.user.id));
});
