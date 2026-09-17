/**
 * Accept-offer settlement orchestration.
 *
 * Combines the three steps a borrower's acceptance triggers — respond → record
 * payment → complete (creating a refinance obligation where applicable) —
 * behind one call, so UI components don't own this business logic (SoC).
 */
import type { LoanOffer } from '@/types/loans';
import { CURRENCY_CODES, PLATFORM_DEFAULT_CURRENCY, type CurrencyCode } from '@/config/currencies';
import type { LoanPaymentMethod } from '@/config/loan-payments';
import { respondToOffer } from './offers';
import { createPayment, completePayment } from './payments';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export interface AcceptOfferSettlementParams {
  offer: LoanOffer;
  borrowerId: string;
  paymentMethod: LoanPaymentMethod;
  transactionId?: string;
  notes?: string;
}

export interface AcceptOfferSettlementResult {
  success: boolean;
  error?: string;
  /** True once the offer was accepted — the caller should refresh even if a later step fails. */
  mutated: boolean;
  /** True when a refinance obligation handoff completed. */
  refinanced?: boolean;
}

export async function acceptOfferAndSettle(
  params: AcceptOfferSettlementParams
): Promise<AcceptOfferSettlementResult> {
  const { offer, borrowerId, paymentMethod, transactionId, notes } = params;
  const isRefinance = offer.offer_type === 'refinance';

  const respond = await respondToOffer(offer.id, true, notes);
  if (!respond.success) {
    return {
      success: false,
      error: apiErrorMessage(respond, 'Failed to accept offer'),
      mutated: false,
    };
  }

  const loanCurrency =
    (offer.loans?.currency as CurrencyCode | undefined) ?? PLATFORM_DEFAULT_CURRENCY;
  const payment = await createPayment({
    loan_id: offer.loan_id,
    offer_id: offer.id,
    amount: offer.offer_amount,
    currency: CURRENCY_CODES.includes(loanCurrency) ? loanCurrency : PLATFORM_DEFAULT_CURRENCY,
    payment_type: isRefinance ? 'refinance' : 'payoff',
    payer_id: offer.offerer_id,
    recipient_id: borrowerId,
    payment_method: paymentMethod,
    transaction_id: transactionId,
    notes,
  });
  if (!payment.success || !payment.payment) {
    return {
      success: false,
      error: apiErrorMessage(payment, 'Offer accepted, but payment record failed'),
      mutated: true,
    };
  }

  const complete = await completePayment(payment.payment.id, {
    ...(isRefinance
      ? {
          createObligation: {
            lenderProfileName:
              offer.profiles?.display_name || offer.profiles?.username || 'New lender',
          },
        }
      : {}),
  });
  if (!complete.success) {
    return {
      success: false,
      error: apiErrorMessage(complete, 'Payment created, but completion failed'),
      mutated: true,
    };
  }

  return { success: true, mutated: true, refinanced: isRefinance };
}
