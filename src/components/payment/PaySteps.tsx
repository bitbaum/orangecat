'use client';

/**
 * The steps every payment shares after the amount: the code, the claim that
 * waits on the recipient, and the two endings that are not a receipt.
 *
 * They were drawn four times (PayFlow, the support card, the purchase dialog,
 * the ticket card), each with its own waiting line and its own way back, or
 * none. /pay's drawing is the model: the code, one quiet waiting line, the
 * honesty line, and a way back under every code. The receipt itself is
 * MoneyReceipt (src/components/money).
 */

import { AlertCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PaymentQRCode } from '@/components/payment/PaymentQRCode';
import { PAYMENT_FLOW_COPY } from '@/config/payment-flow';

interface PayCodeStepProps {
  qrData: string;
  methodLabel: string;
  amountBtc: number;
  expiresInSeconds?: number;
  /** What the payment is for, kept on the step where the payer decides. */
  note?: React.ReactNode;
  waitingLabel?: string;
  custodyLine?: string;
  /** The way back: "Change amount" where the payer chose it, "Back" on a price. */
  backLabel?: string;
  onBack?: () => void;
  /** Only on a rail that cannot prove payment: the payer says they paid. */
  onClaimPaid?: () => void;
  /** A line under the code, e.g. why "I've paid" could not be recorded. */
  notice?: string | null;
  /** Extra actions beside the way back (a modal's Done). */
  children?: React.ReactNode;
}

export function PayCodeStep({
  qrData,
  methodLabel,
  amountBtc,
  expiresInSeconds,
  note,
  waitingLabel = PAYMENT_FLOW_COPY.waiting,
  custodyLine = PAYMENT_FLOW_COPY.custody,
  backLabel = PAYMENT_FLOW_COPY.changeAmount,
  onBack,
  onClaimPaid,
  notice,
  children,
}: PayCodeStepProps) {
  return (
    <div className="space-y-4">
      {note}
      <PaymentQRCode
        qrData={qrData}
        methodLabel={methodLabel}
        amountBtc={amountBtc}
        expiresInSeconds={expiresInSeconds}
      />
      <p className="flex items-center justify-center gap-2 text-center text-sm text-fg-secondary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {waitingLabel}
      </p>
      {onClaimPaid && (
        <Button variant="outline" onClick={onClaimPaid} className="w-full">
          {PAYMENT_FLOW_COPY.iPaid}
        </Button>
      )}
      {notice && (
        <p role="status" className="text-center text-sm text-fg-secondary">
          {notice}
        </p>
      )}
      <p className="text-center text-xs text-fg-tertiary">{custodyLine}</p>
      {(onBack || children) && (
        <div className="flex flex-wrap justify-center gap-3">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              {backLabel}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

/** The amount step is done and the code is being made. */
export function PayPreparingStep({ label = PAYMENT_FLOW_COPY.preparing }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-fg-tertiary" aria-hidden="true" />
      <p className="mb-0 text-sm text-fg-secondary">{label}</p>
    </div>
  );
}

interface PayOutcomeProps {
  title: string;
  body?: string | null;
  children?: React.ReactNode;
}

function PayOutcome({
  icon: Icon,
  tone,
  title,
  body,
  children,
}: PayOutcomeProps & { icon: React.ElementType; tone: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <Icon className={`h-12 w-12 ${tone}`} aria-hidden="true" />
      <p className="mb-0 text-lg font-semibold text-fg-primary">{title}</p>
      {body && <p className="mb-0 max-w-xs text-sm text-fg-secondary">{body}</p>}
      {children && <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

/** The code ran out before a payment arrived. Nothing moved. */
export function PayExpiredStep({
  title = PAYMENT_FLOW_COPY.expiredTitle,
  body = PAYMENT_FLOW_COPY.expiredBody,
  againLabel = PAYMENT_FLOW_COPY.again,
  onAgain,
}: Partial<PayOutcomeProps> & { againLabel?: string; onAgain: () => void }) {
  return (
    <PayOutcome icon={Clock} tone="text-fg-tertiary" title={title} body={body}>
      <Button variant="outline" onClick={onAgain}>
        {againLabel}
      </Button>
    </PayOutcome>
  );
}

/** The request could not be made, or the rail reported a failure. */
export function PayFailedStep({
  message,
  notStarted = false,
  againLabel = PAYMENT_FLOW_COPY.again,
  onAgain,
}: {
  message?: string | null;
  /** The request was never made: say that, not that a payment failed. */
  notStarted?: boolean;
  againLabel?: string;
  onAgain: () => void;
}) {
  return (
    <PayOutcome
      icon={AlertCircle}
      tone="text-status-negative"
      title={notStarted ? PAYMENT_FLOW_COPY.notStartedTitle : PAYMENT_FLOW_COPY.failedTitle}
      body={message}
    >
      <Button variant="outline" onClick={onAgain}>
        {againLabel}
      </Button>
    </PayOutcome>
  );
}

/** The payer said "I've paid"; nothing has checked it. The recipient confirms. */
export function PayClaimedStep({
  body = PAYMENT_FLOW_COPY.claimedBody,
  children,
}: {
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <PayOutcome
      icon={Clock}
      tone="text-fg-secondary"
      title={PAYMENT_FLOW_COPY.claimedTitle}
      body={body}
    >
      {children}
    </PayOutcome>
  );
}
