/**
 * POST /api/tips/status { intentId, token } — poll whether a tip has settled.
 * Account-free: access is granted by the opaque bearer token minted with the
 * tip (its SHA-256 hash is stored on the intent), not by a session. Detection
 * reuses the generic public status check (NWC lookup / LUD-21 verify / on-chain).
 * On settlement the recipient is notified server-side by the shared settle path.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { rateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import { apiBadRequest, apiError, apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { getTipStatus } from '@/domain/tips/tip-service';
import { logger } from '@/utils/logger';

const bodySchema = z.object({
  intentId: z.string().guid(),
  token: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimit(request);
    if (!rl.success) {
      return createRateLimitResponse(rl);
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return apiBadRequest('Invalid request', parsed.error.flatten());
    }

    try {
      const status = await getTipStatus(parsed.data.intentId, parsed.data.token);
      return apiSuccess(status);
    } catch {
      // checkPublicPaymentStatus throws only when the (id, token) pair matches no
      // intent — treat as not-found without leaking which half was wrong.
      return apiError('Tip not found', 'TIP_NOT_FOUND', 404);
    }
  } catch (error) {
    logger.error('tips/status failed', error, 'TipsAPI');
    return apiInternalError('Could not check tip status.');
  }
}
