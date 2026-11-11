/**
 * /api/identities — the identities the signed-in person holds (ADR-0014).
 *
 * GET  lists the caller's circle: the holder and every identity it holds.
 * POST creates one. Body: { name, username }.
 *
 * Session only. The circle is derived from the signed-in user on the service
 * role; no id from the request is ever trusted as "mine".
 */
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiConflict,
  apiCreated,
  apiForbidden,
  apiInternalError,
  apiRateLimited,
  apiSuccess,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import { IDENTITIES_COPY, MAX_IDENTITIES } from '@/config/identities';
import { createIdentity, getCircle } from '@/domain/identities/service';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const circle = await getCircle(getAdminClient(), req.user.id);
    return apiSuccess({
      members: circle.members.map(m => ({ ...m, isCurrent: m.id === req.user.id })),
      max: MAX_IDENTITIES,
    });
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const rl = await rateLimitWriteAsync(req.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    let body: { name?: unknown; username?: unknown };
    try {
      body = await req.json();
    } catch {
      return apiBadRequest('Invalid request body');
    }

    const result = await createIdentity(getAdminClient(), req.user.id, {
      name: body.name,
      username: body.username,
    });
    if (result.ok) {
      return apiCreated(result.data);
    }
    switch (result.reason) {
      case 'invalid_name':
        return apiBadRequest('Enter a name of up to 60 characters.');
      case 'invalid_username':
        return apiBadRequest(result.message ?? 'That username cannot be used.');
      case 'username_taken':
        return apiConflict(IDENTITIES_COPY.usernameTaken);
      case 'limit_reached':
        return apiForbidden(IDENTITIES_COPY.limitReached);
      case 'holder_needs_email':
        return apiForbidden(IDENTITIES_COPY.needsEmail);
      default:
        return apiInternalError(IDENTITIES_COPY.createFailed);
    }
  } catch (error) {
    return handleApiError(error);
  }
});
