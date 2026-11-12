/**
 * POST /api/identities/handover/accept — take over an identity that was
 * offered by link (ADR-0014 D9).
 *
 * Body: { token, email }. No session is needed and none is trusted: the link
 * is the whole credential, as a claim link is (ADR-0004). On success the
 * identity is an ordinary account on `email`, its former holder is cut off,
 * and this browser is signed in to it.
 */
import { type NextRequest } from 'next/server';
import {
  apiBadRequest,
  apiConflict,
  apiError,
  apiInternalError,
  apiSuccess,
  handleApiError,
} from '@/lib/api/standardResponse';
import { createRateLimitResponse, rateLimitEmailCodeByIp } from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { IDENTITIES_COPY } from '@/config/identities';
import { acceptHandover } from '@/domain/identities/handover';
import { logger } from '@/utils/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Unauthenticated and guessable only by brute force over 256 bits; the
    // limit is here so that is not attempted cheaply either.
    const byIp = await rateLimitEmailCodeByIp(request);
    if (!byIp.success) {
      return createRateLimitResponse(byIp);
    }

    let body: { token?: unknown; email?: unknown };
    try {
      body = await request.json();
    } catch {
      return apiBadRequest('Invalid request body');
    }
    const token = typeof body.token === 'string' ? body.token : '';

    const admin = getAdminClient();
    const result = await acceptHandover(admin, token, body.email);
    if (!result.ok) {
      switch (result.reason) {
        case 'gone':
          return apiError(IDENTITIES_COPY.acceptGone, 'GONE', 410);
        case 'invalid_email':
          return apiBadRequest(IDENTITIES_COPY.acceptInvalidEmail);
        case 'email_taken':
          return apiConflict(IDENTITIES_COPY.acceptEmailTaken);
        default:
          return apiInternalError(IDENTITIES_COPY.acceptFailed);
      }
    }

    // Sign this browser in as the account that is now theirs. The same
    // generate-then-exchange as a switch; a failure here loses nothing, the
    // person signs in with their address by emailed code.
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: result.email,
    });
    const code = data?.properties?.email_otp;
    let signedIn = false;
    if (!error && code) {
      const supabase = await createServerClient();
      const exchange = await supabase.auth.verifyOtp({
        email: result.email,
        token: code,
        type: 'email',
      });
      signedIn = !exchange.error;
    }
    if (!signedIn) {
      logger.warn('Handover accepted but sign-in did not complete', {}, 'Identities');
    }
    return apiSuccess({ accepted: true, signedIn });
  } catch (error) {
    return handleApiError(error);
  }
}
