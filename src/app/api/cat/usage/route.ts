/**
 * GET /api/cat/usage — today's quota plus what it MEANS: whether today's pace
 * runs into the cap, the last seven days, what Cat remembers, and the levers
 * that are really open. Feeds the "What this means" card on /settings/usage.
 *
 * Counts and sentences only; reads run on the caller's client, so RLS scopes
 * every row to the person asking.
 */
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess } from '@/lib/api/standardResponse';
import { readCatUsageSummary } from '@/services/cat/usage-summary';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  return apiSuccess(await readCatUsageSummary(request.supabase, request.user.id));
});
