/**
 * Known payment-domain error patterns → safe client-facing messages.
 *
 * Shared by the internal /api/payments route and the public /api/v1/payments
 * contract so both surfaces translate domain errors identically without
 * leaking internals.
 */
const KNOWN_PAYMENT_ERRORS: Record<string, string> = {
  'no wallet': 'Seller has no payment method configured',
  'own entity': 'You cannot pay for your own entity',
  'no price': 'This entity has no price set',
  'Amount is required': 'Payment amount is required for contributions',
  'owner not found': 'This listing is no longer available.',
  'not publicly available': 'This listing is not available.',
  'event has ended': 'This event has ended.',
  'LNURL-pay endpoint': 'Seller Lightning Address is unreachable. Try again later.',
  'outside allowed range': 'Payment amount is outside the allowed range for this seller.',
  'LNURL callback': 'Lightning Address invoice request failed. Try again later.',
  'not a pay request': 'Seller Lightning Address is not configured correctly.',
  'exchange rate unavailable':
    'We could not check the Bitcoin exchange rate just now, so we did not want to guess the amount. Please try again in a moment.',
};

/**
 * A refusal already written for the payer: it names the minimum or maximum an
 * entity states (src/config/contribution-terms.ts), so it is shown as it is.
 */
export class ContributionOutsideTermsError extends Error {}

/** Returns the safe message for a known domain error, or null for unknown errors. */
export function mapKnownPaymentError(message: string, error?: unknown): string | null {
  if (error instanceof ContributionOutsideTermsError) {
    return error.message;
  }
  for (const [pattern, safeMessage] of Object.entries(KNOWN_PAYMENT_ERRORS)) {
    if (message.includes(pattern)) {
      return safeMessage;
    }
  }
  return null;
}
