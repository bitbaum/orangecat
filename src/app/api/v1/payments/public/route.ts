import {
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { initiatePublicSupport } from '@/domain/payments';
import { publicSupportCreateSchema } from '@/lib/validation/finance';
import { createPublicClient } from '@/lib/supabase/public';
import { rateLimitPaymentRecipient, rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { logger } from '@/utils/logger';
import { clientIpKey } from '@/lib/client-ip';

function requestKey(request: Request): string {
  return `public-support:${clientIpKey(request)}`;
}

export async function POST(request: Request) {
  const limit = await rateLimitWriteAsync(requestKey(request));
  if (!limit.success) {
    return apiRateLimited(
      'Too many payment requests. Please try again shortly.',
      retryAfterSeconds(limit)
    );
  }

  try {
    const parsed = publicSupportCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiBadRequest('Invalid support request', parsed.error.issues);
    }

    // After parsing, because the recipient is in the body — and BEFORE
    // initiatePublicSupport, which is the call that mints a real invoice
    // through the recipient's wallet. Per-IP alone leaves a seller exposed to
    // an attacker who rotates addresses.
    const recipientLimit = await rateLimitPaymentRecipient(
      parsed.data.entity_type,
      parsed.data.entity_id
    );
    if (!recipientLimit.success) {
      return apiRateLimited(
        'This page is receiving too many payment requests right now. Please try again shortly.',
        retryAfterSeconds(recipientLimit)
      );
    }

    const result = await initiatePublicSupport(createPublicClient(), parsed.data);
    return apiSuccess(result, { status: 201, cache: 'NONE' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment initiation failed';
    logger.error('Public support initiation failed', { error });

    const safeErrors: Array<[string, string]> = [
      ['not publicly available', 'This page is not available for public support.'],
      ['cannot receive', 'This kind of page cannot receive public support.'],
      ['owner not found', 'This page no longer has a receiving owner.'],
      ['no wallet', 'The owner has not connected a Bitcoin wallet yet.'],
      ['outside allowed range', 'That amount is outside the wallet provider’s allowed range.'],
      [
        'exchange rate unavailable',
        'We could not check the Bitcoin exchange rate just now, so we did not want to guess the amount. Please try again in a moment.',
      ],
      ['LNURL', 'The Lightning Address could not create an invoice. Try again later.'],
    ];
    for (const [pattern, safe] of safeErrors) {
      if (message.toLowerCase().includes(pattern.toLowerCase())) {
        return apiBadRequest(safe);
      }
    }
    return apiInternalError('Could not create the Bitcoin payment request.');
  }
}
