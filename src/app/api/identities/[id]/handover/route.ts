/**
 * /api/identities/[id]/handover — offer an identity to someone else, or
 * withdraw the offer (ADR-0014 D9).
 *
 * POST returns the hand-over link ONCE. Only the hash of its token is stored,
 * so it cannot be shown again; offering again replaces it.
 */
import type { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiBadRequest,
  apiInternalError,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
  handleApiError,
} from '@/lib/api/standardResponse';
import { getValidationError, validateUUID } from '@/lib/api/validation';
import { sessionMethods } from '@/lib/auth/session-methods';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import { SITE_URL } from '@/config/brand';
import { IDENTITIES_COPY, handoverAcceptPath } from '@/config/identities';
import { cancelHandover, offerHandover } from '@/domain/identities/handover';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

type Guarded =
  | { ok: false; response: NextResponse }
  | { ok: true; id: string; caller: { userId: string; sessionMethods: string[] } };

async function guard(req: AuthenticatedRequest, context: RouteContext): Promise<Guarded> {
  const rl = await rateLimitWriteAsync(req.user.id);
  if (!rl.success) {
    return {
      ok: false,
      response: apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl)),
    };
  }
  const { id } = await context.params;
  const invalid = getValidationError(validateUUID(id, 'identity id'));
  if (invalid) {
    return { ok: false, response: invalid };
  }
  return {
    ok: true,
    id,
    caller: { userId: req.user.id, sessionMethods: await sessionMethods(req.supabase) },
  };
}

export const POST = withAuth(async (req: AuthenticatedRequest, context: RouteContext) => {
  try {
    const g = await guard(req, context);
    if (!g.ok) {
      return g.response;
    }
    const result = await offerHandover(getAdminClient(), g.caller, g.id);
    if (!result.ok) {
      if (result.reason === 'not_in_circle') {
        return apiNotFound('Identity');
      }
      if (result.reason === 'is_holder') {
        return apiBadRequest('Your main account cannot be handed over.');
      }
      return apiInternalError(IDENTITIES_COPY.handOverFailed);
    }
    // The site's public address, not the request's: behind the proxy the
    // request's own origin is an internal one.
    const link = `${SITE_URL}${handoverAcceptPath(result.data.token)}`;
    return apiSuccess({ link, expiresAt: result.data.expiresAt });
  } catch (error) {
    return handleApiError(error);
  }
});

export const DELETE = withAuth(async (req: AuthenticatedRequest, context: RouteContext) => {
  try {
    const g = await guard(req, context);
    if (!g.ok) {
      return g.response;
    }
    const result = await cancelHandover(getAdminClient(), g.caller, g.id);
    if (!result.ok) {
      return result.reason === 'not_in_circle'
        ? apiNotFound('Identity')
        : apiInternalError(IDENTITIES_COPY.handOverCancelFailed);
    }
    return apiSuccess({ cancelled: true });
  } catch (error) {
    return handleApiError(error);
  }
});
