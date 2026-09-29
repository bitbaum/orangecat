/**
 * POST /api/auth/signout-everywhere — end every session this person has, on
 * every product.
 *
 * The browser's own `signOut({ scope: 'global' })` revokes OrangeCat's
 * sessions (GoTrue refresh tokens). It cannot reach the OAuth refresh tokens
 * that Solon, Loki, Heidi and any outside site hold, so "sign out everywhere"
 * used to leave the person signed in everywhere except here. This route
 * revokes those too; the browser calls it first, then signs itself out.
 * Consents are kept: a first-party app should not ask permission again after
 * a lost-device sign-out. Access tokens already issued run out within the hour.
 */
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiRateLimited, apiSuccess, handleApiError } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { revokeAllConnectedApps } from '@/services/auth/connectedApps';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const rl = await rateLimitWriteAsync(req.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const result = await revokeAllConnectedApps(req.user.id, { forgetConsents: false });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
});
