/**
 * Wallet Receive Verification API
 *
 * POST /api/wallets/verify — can this address actually be paid?
 *
 * Server-side because resolving a Lightning address calls a third party, and
 * doing that from the browser would hand over the visitor's IP. Rate-limited
 * because each call makes two outbound requests to someone else's server.
 *
 * Deliberately does NOT save anything and never blocks a save: a provider that
 * is briefly down must not stop someone recording a correct address. It answers
 * one question honestly and lets the caller decide.
 */

import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess, apiBadRequest, apiRateLimited } from '@/lib/api/standardResponse';
import { applyRateLimitHeaders, rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { verifyReceiveCapability } from '@/domain/wallets/verifyReceive';
import { logger } from '@/utils/logger';

const bodySchema = z.object({
  kind: z.enum(['lightning_address', 'onchain', 'nwc']),
  value: z.string().min(1).max(2000),
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user } = request;

  const limit = await rateLimitWriteAsync(user.id);
  if (!limit.success) {
    return apiRateLimited('Too many checks. Please slow down.', retryAfterSeconds(limit));
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return apiBadRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
  }

  try {
    const verdict = await verifyReceiveCapability(parsed.data.kind, parsed.data.value);
    return applyRateLimitHeaders(apiSuccess({ verdict }), limit);
  } catch (error) {
    // An outage here is not the user's address being wrong. Answer "unknown"
    // rather than accusing a valid wallet of being broken.
    logger.error('Wallet verification failed', { error });
    return applyRateLimitHeaders(
      apiSuccess({
        verdict: {
          status: 'unknown',
          detail: 'Could not check this right now. It has been saved either way.',
        },
      }),
      limit
    );
  }
});
