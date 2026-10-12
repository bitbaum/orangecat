/**
 * DELETE /api/connected-apps/[clientId] — take back an app's access: forget
 * the consent and revoke its refresh tokens for the caller. Idempotent.
 *
 * PATCH /api/connected-apps/[clientId] { withheld: ["picture", …] } — choose
 * which profile claims (name, preferred_username, picture) this app receives.
 * Nothing is revoked; the app just stops being sent what was withheld.
 *
 * Session auth only (same reason as integration keys): an app must never be
 * able to revoke — or enumerate — the other apps a person connected.
 */
import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  apiBadRequest,
  apiNotFound,
  apiRateLimited,
  apiSuccess,
  apiUnauthorized,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { PROFILE_CLAIMS } from '@/lib/oauth/config';
import { revokeConnectedApp, setWithheldClaims } from '@/services/auth/connectedApps';

export const dynamic = 'force-dynamic';

/** A client_id as the provider mints or accepts it: short, printable, no spaces. */
const CLIENT_ID = /^[A-Za-z0-9._:-]{1,120}$/;

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiUnauthorized();
    }
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const { clientId } = await params;
    if (!CLIENT_ID.test(clientId)) {
      return apiBadRequest('Invalid client id');
    }
    const result = await revokeConnectedApp(user.id, clientId);
    if (!result.revoked) {
      return apiNotFound('Connected app');
    }
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

const KNOWN_CLAIMS: ReadonlySet<unknown> = new Set(PROFILE_CLAIMS.map(c => c.claim));

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return apiUnauthorized();
    }
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const { clientId } = await params;
    if (!CLIENT_ID.test(clientId)) {
      return apiBadRequest('Invalid client id');
    }
    const body = (await req.json().catch(() => null)) as { withheld?: unknown } | null;
    const withheld = body?.withheld;
    if (
      !Array.isArray(withheld) ||
      withheld.length > PROFILE_CLAIMS.length ||
      withheld.some(claim => !KNOWN_CLAIMS.has(claim))
    ) {
      return apiBadRequest(
        `withheld must be a list of: ${PROFILE_CLAIMS.map(c => c.claim).join(', ')}`
      );
    }
    const result = await setWithheldClaims(user.id, clientId, withheld);
    if (!result.updated) {
      return apiNotFound('Connected app');
    }
    return apiSuccess({ withheld: result.withheldClaims });
  } catch (error) {
    return handleApiError(error);
  }
}
