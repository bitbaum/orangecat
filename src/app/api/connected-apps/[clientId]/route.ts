/**
 * DELETE /api/connected-apps/[clientId] — take back an app's access: forget
 * the consent and revoke its refresh tokens for the caller. Idempotent.
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
import { revokeConnectedApp } from '@/services/auth/connectedApps';

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
