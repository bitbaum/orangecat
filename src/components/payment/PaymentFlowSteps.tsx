'use client';

/**
 * A signed-in payment after its amount step, in the one flow's steps: the
 * code, the claim that waits on the recipient, the receipt, and the two
 * not-paid endings. Driven by {@link usePaymentFlow}; the purchase dialog and
 * the booking's pay card both draw it, so neither has its own states.
 */

import { MoneyReceipt } from '@/components/money/MoneyReceipt';
import {
  PayClaimedStep,
  PayCodeStep,
  PayExpiredStep,
  PayFailedStep,
  PayPreparingStep,
} from './PaySteps';
import { PAYMENT_FLOW_COPY, receiptNote } from '@/config/payment-flow';
import type { usePaymentFlow } from '@/hooks/usePaymentFlow';

interface PaymentFlowStepsProps {
  flow: Pick<ReturnType<typeof usePaymentFlow>, 'state' | 'confirmPaid' | 'reset'>;
  /** The amount is a price, not the payer's choice: the way back is "Back". */
  fixedAmount: boolean;
  /** Who is paid, for the receipt's "To". */
  payeeName?: string | null;
  /** What is paid for, for the receipt's "For". */
  forWhat?: string | null;
  receiptFootnote?: string | null;
  /** Actions once the payer is done here: the receipt's and the claim's. */
  children?: React.ReactNode;
}

export function PaymentFlowSteps({
  flow,
  fixedAmount,
  payeeName,
  forWhat,
  receiptFootnote,
  children,
}: PaymentFlowStepsProps) {
  const { state, confirmPaid, reset } = flow;

  if (state.phase === 'initiating') {
    return <PayPreparingStep />;
  }

  if (state.phase === 'awaiting_payment') {
    const intent = state.data.payment_intent;
    // "I've paid" ONLY for a bare Lightning address (no LUD-21 verify URL) —
    // the single rail we can't auto-detect. Every other rail is confirmed
    // automatically and the server refuses a manual claim for it. Keep in sync
    // with buyerConfirmPayment's guard.
    const undetectable = intent.payment_method === 'lightning_address' && !intent.lnurl_verify_url;
    return (
      <PayCodeStep
        qrData={state.data.qr_data}
        methodLabel={state.data.method_label}
        amountBtc={intent.amount_btc}
        expiresInSeconds={state.data.expires_in_seconds ?? undefined}
        backLabel={fixedAmount ? PAYMENT_FLOW_COPY.back : PAYMENT_FLOW_COPY.changeAmount}
        onBack={reset}
        onClaimPaid={undetectable ? confirmPaid : undefined}
        notice={state.notice}
      />
    );
  }

  if (state.phase === 'success') {
    return (
      <MoneyReceipt
        title={PAYMENT_FLOW_COPY.paidTitle}
        amountBtc={state.data.payment_intent.amount_btc}
        counterparty={payeeName?.trim() || null}
        note={receiptNote(forWhat, payeeName)}
        footnote={receiptFootnote}
      >
        {children}
      </MoneyReceipt>
    );
  }

  if (state.phase === 'claimed') {
    return <PayClaimedStep>{children}</PayClaimedStep>;
  }

  if (state.phase === 'expired') {
    return <PayExpiredStep onAgain={reset} />;
  }

  if (state.phase === 'error') {
    return <PayFailedStep message={state.message} notStarted={state.notStarted} onAgain={reset} />;
  }

  return null;
}
