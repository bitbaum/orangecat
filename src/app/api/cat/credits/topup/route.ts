/**
 * Cat Credits — Lightning top-up API
 *
 * POST /api/cat/credits/topup        { amountBtc }  → issue an invoice
 * GET  /api/cat/credits/topup?id=ID                 → poll settlement status
 *
 * Gated on a configured platform receiving wallet (PLATFORM_NWC_URI). When
 * unset, returns 503 — the UI keeps top-up disabled. See
 * docs/architecture/CAT_CREDITS.md.
 */

import { z } from 'zod';
import {
  initiateTopUp,
  checkTopUp,
  MIN_TOPUP_BTC,
  MAX_TOPUP_BTC,
} from '@/services/cat/credit-topup';
import { platformReceiveEnabled } from '@/lib/bitcoin/platform-wallet';
import { PAID_PLANS_OPEN, COMMERCE_CLOSED } from '@/config/commerce';
import { apiSuccess, apiError, apiRateLimited, handleApiError } from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';

const bodySchema = z.object({
  amountBtc: z.number().positive().max(MAX_TOPUP_BTC).min(MIN_TOPUP_BTC),
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user } = request;

  // Two independent refusals, both server-side. PAID_PLANS_OPEN is the
  // commercial one (may we charge at all) and is checked again inside
  // initiateTopUp, so no caller can reach the wallet by another route.
  if (!PAID_PLANS_OPEN) {
    return apiError(COMMERCE_CLOSED.short, 'PAID_PLANS_NOT_OPEN', 503);
  }
  if (!platformReceiveEnabled()) {
    return apiError('Lightning top-up is not available yet', 'TOPUP_DISABLED', 503);
  }

  const rl = await rateLimitWriteAsync(user.id);
  if (!rl.success) {
    return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
  }

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError('Invalid top-up amount', 'BAD_REQUEST', 400);
    }
    const invoice = await initiateTopUp(user.id, parsed.data.amountBtc);
    if (!invoice) {
      return apiError('Could not create a top-up invoice', 'TOPUP_FAILED', 502);
    }
    return apiSuccess(invoice);
  } catch (error) {
    return handleApiError(error);
  }
});

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user } = request;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return apiError('Provide ?id=<topupId>', 'BAD_REQUEST', 400);
  }
  try {
    const status = await checkTopUp(user.id, id);
    return apiSuccess(status);
  } catch (error) {
    return handleApiError(error);
  }
});
