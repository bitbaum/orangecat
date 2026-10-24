/**
 * /api/payment-requests — person-to-person asks for money.
 *
 * GET  lists both directions for the caller.
 * POST creates a request addressed to another OrangeCat user.
 *
 * Authorship is enforced by RLS (you may only ask on your own behalf), not by
 * trusting the body: a request that could be minted in someone else's name
 * would be a phishing primitive, so the requester always comes from the session.
 */

import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { createPaymentRequest, listPaymentRequests } from '@/domain/payments/paymentRequestService';
import { PAY_MAX_BTC, PAY_MIN_BTC } from '@/config/pay';
import { REQUEST_NOTE_MAX_LENGTH } from '@/config/payment-requests';
import { logger } from '@/utils/logger';

const createSchema = z
  .object({
    payer_username: z.string().min(1).max(64),
    // A request is asked for in BTC, or in a currency (which the server prices itself).
    amount_btc: z.number().positive().min(PAY_MIN_BTC).max(PAY_MAX_BTC).optional(),
    ask: z
      .object({ amount: z.number().positive().max(1_000_000_000), currency: z.string().length(3) })
      .optional(),
    note: z.string().max(REQUEST_NOTE_MAX_LENGTH).optional(),
  })
  .refine(body => body.amount_btc !== undefined || body.ask !== undefined, {
    message: 'Enter an amount.',
  });

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;
    return apiSuccess(await listPaymentRequests(supabase, user.id));
  } catch (error) {
    logger.error('list payment requests failed', { error }, 'PaymentRequest');
    return apiInternalError('Could not load your requests.');
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return apiBadRequest('Invalid request', parsed.error.flatten());
    }

    const result = await createPaymentRequest(supabase, user.id, {
      payerUsername: parsed.data.payer_username,
      amountBtc: parsed.data.amount_btc,
      ask: parsed.data.ask,
      note: parsed.data.note,
    });

    if (!result.ok) {
      return apiBadRequest(result.message, { reason: result.reason });
    }
    return apiSuccess({ request: result.request }, { status: 201 });
  } catch (error) {
    logger.error('create payment request failed', { error }, 'PaymentRequest');
    return apiInternalError('Could not create that request.');
  }
});
