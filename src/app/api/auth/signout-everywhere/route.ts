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
import { getAdminClient } from '@/lib/supabase/admin';
import { sessionMethods } from '@/lib/auth/session-methods';
import { callRpc } from '@/lib/supabase/untyped';
import { otherCircleMemberIds } from '@/domain/identities/service';
import { revokeAllConnectedApps } from '@/services/auth/connectedApps';
import { logger } from '@/utils/logger';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const rl = await rateLimitWriteAsync(req.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const result = await revokeAllConnectedApps(req.user.id, { forgetConsents: false });

    // A session for one identity can become a session for any other the same
    // person holds (ADR-0014), so stopping at this account would leave a lost
    // device one switch away from all of them. End the others too.
    const admin = getAdminClient();
    const others = await otherCircleMemberIds(admin, {
      userId: req.user.id,
      sessionMethods: await sessionMethods(req.supabase),
    });
    let identitiesSignedOut = true;
    for (const id of others) {
      await revokeAllConnectedApps(id, { forgetConsents: false });
    }
    if (others.length > 0) {
      const { error } = (await callRpc(admin, 'end_sessions_of', { p_user_ids: others })) as {
        error: { message: string } | null;
      };
      if (error) {
        identitiesSignedOut = false;
        logger.error(
          'Could not end the sessions of other identities',
          { error: error.message, userId: req.user.id },
          'Auth'
        );
      }
    }
    return apiSuccess({ ...result, identitiesSignedOut });
  } catch (error) {
    return handleApiError(error);
  }
});
