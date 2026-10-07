/**
 * POST /api/raise/plan — "I need A" → a priced plan for getting B.
 *
 * Open to visitors who have not signed up yet: the magic has to happen before
 * the account does, or nobody finds out it works. Each call is one platform
 * model call, so it is limited per IP like Ask-Cat. Nothing is written —
 * publishing goes through the entity's own create endpoint, signed in.
 */

import { z } from 'zod';
import {
  apiRateLimited,
  apiSuccess,
  apiValidationError,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimit, rateLimitAskCat, retryAfterSeconds } from '@/lib/rate-limit';
import { CURRENCY_CODES } from '@/config/currencies';
import { RAISE_LIMITS } from '@/config/raise';
import { planRaise } from '@/domain/raise/planner';

const bodySchema = z.object({
  need: z.string().trim().min(RAISE_LIMITS.needMin).max(RAISE_LIMITS.needMax),
  currency: z.enum(CURRENCY_CODES).default('CHF'),
});

export async function POST(request: Request) {
  try {
    for (const limit of [await rateLimit(request), await rateLimitAskCat(request)]) {
      if (!limit.success) {
        return apiRateLimited(
          'That was a lot of plans in a short time. Try again in a few minutes.',
          retryAfterSeconds(limit)
        );
      }
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return apiValidationError('Say what you need in a sentence or two.');
    }
    const plan = await planRaise(parsed.data.need, parsed.data.currency);
    return apiSuccess({ plan });
  } catch (error) {
    return handleApiError(error);
  }
}
