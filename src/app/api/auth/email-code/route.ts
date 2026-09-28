import { NextRequest } from 'next/server';
import {
  apiBadRequest,
  apiError,
  apiServiceUnavailable,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { verifyCaptchaToken } from '@/lib/captcha';
import { clientIpOrUndefined } from '@/lib/client-ip';
import { isEmailConfigured, sendEmail } from '@/lib/email/client';
import {
  createRateLimitResponse,
  rateLimitEmailCodeByEmail,
  rateLimitEmailCodeByIp,
} from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import { getClient } from '@/services/auth/oauthProvider';
import { normalizeEmail, sendSignInCode } from '@/services/auth/emailCode';
import { logger } from '@/utils/logger';

/**
 * POST /api/auth/email-code — mail a six-digit sign-in code.
 *
 * Body: { email, client?, captchaToken? }. `client` is the OAuth client id of
 * the app that sent the person to /auth (lib/oauth/handoff.ts); its display name
 * is looked up here, never taken from the request, so an email can only ever
 * name an app that is registered.
 *
 * The answer is the same whether or not an account exists. The code is
 * verified by the browser against GoTrue directly — see services/auth/emailCode.
 */
export async function POST(request: NextRequest) {
  const byIp = await rateLimitEmailCodeByIp(request);
  if (!byIp.success) {
    return createRateLimitResponse(byIp);
  }

  let body: { email?: unknown; client?: unknown; captchaToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return apiBadRequest('Invalid request body');
  }

  const email = normalizeEmail(body.email);
  if (email) {
    const byEmail = await rateLimitEmailCodeByEmail(email);
    if (!byEmail.success) {
      return createRateLimitResponse(byEmail);
    }
  }

  // The same rule the password sign-up follows: a challenge when this
  // deployment has CAPTCHA configured, none otherwise (no-auth-friction rule).
  if (process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    const token = typeof body.captchaToken === 'string' ? body.captchaToken : '';
    const captcha = await verifyCaptchaToken(token, clientIpOrUndefined(request));
    if (!captcha.success) {
      return apiBadRequest('Please complete the CAPTCHA verification');
    }
  }

  const clientId =
    typeof body.client === 'string' && body.client.length <= 200 ? body.client : null;
  const appName = clientId ? ((await getClient(clientId))?.name ?? null) : null;

  const outcome = await sendSignInCode(
    { email: body.email, appName },
    {
      isEmailConfigured,
      sendEmail,
      generateCode: async target => {
        const { data, error } = await getAdminClient().auth.admin.generateLink({
          type: 'magiclink',
          email: target,
        });
        if (error) {
          logger.warn('Sign-in code generation refused', { code: error.code }, 'EmailCode');
          return null;
        }
        return data.properties?.email_otp ?? null;
      },
    }
  );

  switch (outcome.status) {
    case 'sent':
      return apiSuccess({ sent: true });
    case 'unavailable':
      return apiServiceUnavailable('Sign-in by email code is not available here.');
    case 'invalid':
      return apiBadRequest(outcome.reason);
    case 'failed':
      return apiError(
        'We could not send a code just now. Try again in a minute, or sign in another way.',
        'EMAIL_CODE_FAILED',
        502
      );
  }
}
