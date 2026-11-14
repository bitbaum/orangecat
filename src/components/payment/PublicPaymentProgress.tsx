'use client';

/**
 * The middle and the not-paid endings of an account-free payment, in the one
 * flow's steps (PaySteps): the code while it is open, "I've paid" where the
 * rail cannot prove it, and the way back when it expired or failed. Driven by
 * {@link usePublicPayment}; the caller owns the amount step and the receipt,
 * which are what differ between support, a purchase and a ticket.
 */

import {
  PayClaimedStep,
  PayCodeStep,
  PayExpiredStep,
  PayFailedStep,
  PayPreparingStep,
} from './PaySteps';
import { PAYMENT_FLOW_COPY } from '@/config/payment-flow';
import type { usePublicPayment } from '@/hooks/usePublicPayment';

interface PublicPaymentProgressProps {
  payment: ReturnType<typeof usePublicPayment>;
  /** What happens after "I've paid" on a rail the recipient must confirm. */
  confirmationNote: string;
  /** The amount is a price, not the payer's choice: the way back is "Back". */
  fixedAmount?: boolean;
  /** What the payment is for, shown above the code. */
  note?: React.ReactNode;
}

export function PublicPaymentProgress({
  payment,
  confirmationNote,
  fixedAmount = false,
  note,
}: PublicPaymentProgressProps) {
  const { phase, intent, error, acknowledge, reset } = payment;

  if (phase === 'creating') {
    return <PayPreparingStep />;
  }

  if (phase === 'awaiting' && intent) {
    return (
      <PayCodeStep
        qrData={intent.qr_data}
        methodLabel={intent.method_label}
        amountBtc={intent.payment_intent.amount_btc}
        expiresInSeconds={intent.expires_in_seconds ?? undefined}
        note={note}
        backLabel={fixedAmount ? PAYMENT_FLOW_COPY.back : PAYMENT_FLOW_COPY.changeAmount}
        onBack={reset}
        onClaimPaid={intent.payment_intent.can_acknowledge ? acknowledge : undefined}
      />
    );
  }

  // The payer's word is in; a code here would only invite a second payment.
  if (phase === 'recipient_confirmation' && intent) {
    return <PayClaimedStep body={confirmationNote} />;
  }

  if (phase === 'expired') {
    return <PayExpiredStep onAgain={reset} />;
  }

  if (phase === 'error') {
    return <PayFailedStep message={error} onAgain={reset} />;
  }

  return null;
}
