/**
 * GET /api/connected-apps — the apps this person has let in through
 * "Sign in with OrangeCat" (consents + live sessions), for the settings page.
 *
 * Session auth only, like integration keys: an app must never be able to
 * enumerate or revoke the other apps a person connected.
 */
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess, handleApiError } from '@/lib/api/standardResponse';
import { listConnectedApps } from '@/services/auth/connectedApps';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const apps = await listConnectedApps(req.user.id);
    return apiSuccess({ apps });
  } catch (error) {
    return handleApiError(error);
  }
});
