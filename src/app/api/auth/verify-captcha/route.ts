import { NextRequest } from 'next/server';
import { verifyCaptchaToken } from '@/lib/captcha';
import { logger } from '@/utils/logger';
import { apiSuccess, apiBadRequest, apiInternalError } from '@/lib/api/standardResponse';
import { rateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import { clientIpOrUndefined } from '@/lib/client-ip';
import { apiErrorMessage } from '@/lib/api/errorMessage';

/**
 * POST /api/auth/verify-captcha
 *
 * Verify a Cloudflare Turnstile CAPTCHA token.
 * Used to validate CAPTCHA before registration.
 */
export async function POST(request: NextRequest) {
  try {
    // Unauthenticated + triggers an outbound Turnstile verification per call —
    // per-IP limit so it can't be used as a verification-spam relay.
    const rl = await rateLimit(request);
    if (!rl.success) {
      return createRateLimitResponse(rl);
    }

    let body: { token?: string };
    try {
      body = await request.json();
    } catch (parseError) {
      logger.error('Failed to parse request body in verify-captcha', parseError, 'CaptchaAPI');
      return apiBadRequest('Invalid request body');
    }
    const { token } = body;

    if (!token) {
      return apiBadRequest('CAPTCHA token is required');
    }

    // Get client IP for additional validation — the hop Caddy wrote, not the
    // caller-supplied first one, or the provider's IP heuristics are being fed
    // whatever the caller chose.
    const remoteIp = clientIpOrUndefined(request);

    const result = await verifyCaptchaToken(token, remoteIp);

    if (result.success) {
      return apiSuccess({ timestamp: result.timestamp });
    }

    return apiBadRequest(apiErrorMessage(result, 'CAPTCHA verification failed'));
  } catch (error) {
    logger.error('CAPTCHA verification error', error, 'CaptchaAPI');
    return apiInternalError('Internal server error');
  }
}
