/**
 * Buy a fixed-price listing without an account (Bitcoin).
 *
 * POST { entity_type, entity_id, name, note? } — mints a Bitcoin invoice on the
 * seller's own wallet for the listing's price and writes the order. The
 * response carries the code and a status token; the buyer polls
 * /api/v1/payments/public/[intent] with it, and once the payment settles that
 * poll returns the order's reference for the receipt.
 */
import {
  apiBadRequest,
  apiError,
  apiInternalError,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { GuestPurchaseError, initiateGuestPurchase } from '@/domain/payments/guestPurchase';
import { publicPurchaseCreateSchema } from '@/lib/validation/finance';
import { createPublicClient } from '@/lib/supabase/public';
import {
  rateLimitPaymentRecipient,
  rateLimitWriteAsync,
  retryAfterSeconds,
} from '@/lib/rate-limit';
import { clientIpKey } from '@/lib/client-ip';
import { logger } from '@/utils/logger';

/** Invoice failures a buyer can act on; anything else is ours. */
const SAFE_INVOICE_ERRORS: Array<[string, string]> = [
  ['outside allowed range', 'The price is outside what the seller’s wallet accepts.'],
  ['LNURL', 'The seller’s Lightning Address could not create an invoice. Try again later.'],
];

export async function POST(request: Request) {
  const limit = await rateLimitWriteAsync(`guest-purchase:${clientIpKey(request)}`);
  if (!limit.success) {
    return apiRateLimited('Too many tries. Please wait a moment.', retryAfterSeconds(limit));
  }

  const parsed = publicPurchaseCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiBadRequest(
      parsed.error.issues[0]?.message ?? 'Invalid purchase',
      parsed.error.issues
    );
  }
  const { entity_type: entityType, entity_id: entityId, name, note } = parsed.data;

  // Before the invoice: minting one goes through the seller's wallet, and
  // per-IP alone leaves it open to someone rotating addresses.
  const recipientLimit = await rateLimitPaymentRecipient(entityType, entityId);
  if (!recipientLimit.success) {
    return apiRateLimited(
      'This page is receiving too many payment requests right now. Please try again shortly.',
      retryAfterSeconds(recipientLimit)
    );
  }

  try {
    const result = await initiateGuestPurchase(createPublicClient(), {
      entityType,
      entityId,
      name,
      note,
    });
    return apiSuccess(result, { status: 201, cache: 'NONE' });
  } catch (error) {
    if (error instanceof GuestPurchaseError) {
      return apiError(error.message, 'GUEST_PURCHASE', error.status);
    }
    const message = error instanceof Error ? error.message : '';
    logger.error('Guest purchase failed', { entityType, entityId, error: message });
    for (const [pattern, safe] of SAFE_INVOICE_ERRORS) {
      if (message.toLowerCase().includes(pattern.toLowerCase())) {
        return apiBadRequest(safe);
      }
    }
    return apiInternalError('Could not create the Bitcoin payment request.');
  }
}
