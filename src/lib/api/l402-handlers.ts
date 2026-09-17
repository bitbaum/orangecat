import {
  apiBadRequest,
  apiInternalError,
  apiNotFound,
  apiPaymentRequired,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { createL402Challenge, verifyL402Payment } from '@/domain/payments/l402';
import type { L402Credentials } from '@/domain/payments/l402-codec';
import { publicSupportCreateSchema } from '@/lib/validation/finance';
import { createPublicClient } from '@/lib/supabase/public';
import {
  rateLimitL402Verify,
  rateLimitPaymentRecipient,
  rateLimitWriteAsync,
  retryAfterSeconds,
} from '@/lib/rate-limit';
import { logger } from '@/utils/logger';
import { clientIpKey } from '@/lib/client-ip';

/**
 * The two branches of GET /api/v1/pay/{type}/{id}, kept out of the route file
 * so the route stays what it should be: parse, pick a branch, delegate.
 */

interface PayTarget {
  entityType: string;
  entityId: string;
}

/**
 * Retry-with-proof. Deliberately OFF the challenge budget — a payer who has
 * paid must be able to retry until settlement is seen, and sharing the
 * challenge budget would lock them out of their own purchase.
 *
 * It gets a budget of its own instead. Each check on a non-terminal intent
 * drives an outbound call to the recipient's relay or to mempool, so one valid
 * token would otherwise buy unbounded traffic against someone else's
 * infrastructure. Keyed on the INTENT, which a caller cannot vary without a
 * valid status token for some other payment — so unlike the per-IP budget on
 * the challenge branch, rotating addresses buys nothing here.
 */
export async function handleL402Verify(
  creds: L402Credentials,
  { entityType, entityId }: PayTarget
): Promise<Response> {
  const verifyLimit = await rateLimitL402Verify(creds.paymentIntentId);
  if (!verifyLimit.success) {
    return apiRateLimited(
      'Too many verification checks for this payment. Try again shortly.',
      retryAfterSeconds(verifyLimit)
    );
  }

  try {
    const result = await verifyL402Payment(creds, { entityType, entityId });
    if (result.ok) {
      return apiSuccess(
        {
          status: result.status,
          paid_at: result.paid_at,
          verified_by: result.verified_by,
          entity_type: entityType,
          entity_id: entityId,
        },
        { cache: 'NONE' }
      );
    }
    // Not paid yet — 402 again. The client already holds the invoice from the
    // original challenge, so no new intent is created here.
    return apiPaymentRequired('Invoice not paid yet — pay it, then retry with the preimage.', {
      status: result.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('not found')) {
      return apiNotFound('Payment not found');
    }
    logger.error('L402 verification failed', { error });
    return apiInternalError('Could not verify the payment.');
  }
}

/** Never leak internals — same safe-error surface as the public support route. */
const SAFE_CHALLENGE_ERRORS: Array<[string, string]> = [
  ['not publicly available', 'This entity is not available for public payment.'],
  ['cannot receive', 'This kind of entity cannot receive payments.'],
  ['owner not found', 'This entity no longer has a receiving owner.'],
  ['no wallet', 'The owner has not connected a Bitcoin wallet yet.'],
  ['outside allowed range', 'That amount is outside the wallet provider’s allowed range.'],
  ['LNURL', 'The Lightning Address could not create an invoice. Try again later.'],
];

/** Create an account-less intent and answer 402 with the invoice. */
export async function handleL402Challenge(
  request: Request,
  { entityType, entityId }: PayTarget
): Promise<Response> {
  const limit = await rateLimitWriteAsync(`l402:${clientIpKey(request)}`);
  if (!limit.success) {
    return apiRateLimited(
      'Too many payment requests. Try again shortly.',
      retryAfterSeconds(limit)
    );
  }

  // Per-IP is not enough here. Every challenge mints a REAL invoice through the
  // recipient's own LNURL/NWC relay, so an attacker rotating IPs can still get a
  // seller rate-limited or banned by their wallet provider. This bounds the
  // damage to one recipient however many addresses it arrives from.
  const recipientLimit = await rateLimitPaymentRecipient(entityType, entityId);
  if (!recipientLimit.success) {
    return apiRateLimited(
      'This page is receiving too many payment requests right now. Try again shortly.',
      retryAfterSeconds(recipientLimit)
    );
  }

  const url = new URL(request.url);
  const parsed = publicSupportCreateSchema.safeParse({
    entity_type: entityType,
    entity_id: entityId,
    amount_btc: Number(url.searchParams.get('amount_btc')),
  });
  if (!parsed.success) {
    return apiBadRequest(
      'Invalid payment request — pass ?amount_btc= between 0.000001 and 1.',
      parsed.error.issues
    );
  }

  try {
    const challenge = await createL402Challenge(createPublicClient(), parsed.data);
    return apiPaymentRequired(
      'Pay the invoice, then retry with Authorization: L402 <token>:<preimage>.',
      {
        payment_intent_id: challenge.payment_intent_id,
        token: `${challenge.payment_intent_id}.${challenge.status_token}`,
        bolt11: challenge.bolt11,
        onchain_address: challenge.onchain_address,
        amount_btc: challenge.amount_btc,
        method_label: challenge.method_label,
        expires_in_seconds: challenge.expires_in_seconds,
      },
      challenge.header
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment initiation failed';
    logger.error('L402 challenge creation failed', { error, entityType, entityId });
    for (const [pattern, safe] of SAFE_CHALLENGE_ERRORS) {
      if (message.toLowerCase().includes(pattern.toLowerCase())) {
        return apiBadRequest(safe);
      }
    }
    return apiInternalError('Could not create the payment challenge.');
  }
}
