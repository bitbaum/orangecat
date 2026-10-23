/**
 * POST /api/tips/invoice { username, amountBtc } — mint a non-custodial Bitcoin
 * tip request against the recipient's own wallet. Anonymous tippers are allowed
 * (easy UX); rate-limited per-IP AND per-recipient to protect recipients' NWC
 * relays from invoice-generation abuse (an attacker rotating IPs can't flood one
 * victim). Persists an entity-less payment_intent so the tip can be tracked + the
 * recipient notified on settlement; OrangeCat never touches funds.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { rateLimit, rateLimitTipRecipient, createRateLimitResponse } from '@/lib/rate-limit';
import { apiBadRequest, apiError, apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { TIP_MAX_BTC, TIP_MIN_BTC } from '@/config/tips';
import { initiateTip } from '@/domain/tips/tip-service';
import { logger } from '@/utils/logger';

const bodySchema = z.object({
  username: z.string().trim().min(1).max(60),
  amountBtc: z.number().positive().min(TIP_MIN_BTC).max(TIP_MAX_BTC),
  /** The payment request a pay link came from, when it came from one. */
  requestId: z.string().uuid().optional(),
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

    // Per-recipient cap: bounds invoice generation against any one victim's
    // wallet/relay regardless of the tipper's IP.
    const recipientRl = await rateLimitTipRecipient(parsed.data.username);
    if (!recipientRl.success) {
      return createRateLimitResponse(recipientRl);
    }

    const supabase = await createServerClient();
    const result = await initiateTip(
      supabase,
      parsed.data.username,
      parsed.data.amountBtc,
      parsed.data.requestId
    );
    if (!result.ok) {
      return apiError(result.error, 'TIP_UNAVAILABLE', 400);
    }

    return apiSuccess({ invoice: result.invoice });
  } catch (error) {
    logger.error('tips/invoice failed', error, 'TipsAPI');
    return apiInternalError('Could not create a tip request.');
  }
}
