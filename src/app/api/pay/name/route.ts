/**
 * GET /api/pay/name?name=<handle>: may a visitor claim this pay-link name?
 *
 * The home page promises "orangecat.ch/pay/your-name"; this is what keeps the
 * promise honest before the visitor signs up for a name somebody already has.
 * It answers what /pay/<name> already shows anyone (the page exists or it does
 * not), so it tells nothing new. A name an account used to have counts as
 * taken: the old link still pays that account.
 */
import type { NextRequest } from 'next/server';
import { isReservedUsername, isValidUsername } from '@/config/usernames';
import { resolveLnurlRecipient } from '@/domain/lightning-address/lnurl-service';
import { apiInternalError, apiRateLimited, apiSuccess } from '@/lib/api/standardResponse';
import { rateLimit, retryAfterSeconds } from '@/lib/rate-limit';
import { logger } from '@/utils/logger';

export type PayNameStatus = 'available' | 'taken' | 'invalid';

export async function GET(request: NextRequest) {
  const limit = await rateLimit(request);
  if (!limit.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(limit));
  }
  const name = (request.nextUrl.searchParams.get('name') ?? '').trim();
  if (!isValidUsername(name)) {
    return apiSuccess({ status: 'invalid' satisfies PayNameStatus });
  }
  if (isReservedUsername(name)) {
    return apiSuccess({ status: 'taken' satisfies PayNameStatus });
  }
  try {
    const holder = await resolveLnurlRecipient(name);
    return apiSuccess({ status: (holder ? 'taken' : 'available') satisfies PayNameStatus });
  } catch (error) {
    logger.error('GET /api/pay/name failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiInternalError();
  }
}
