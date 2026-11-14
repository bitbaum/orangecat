'use client';

/**
 * PayFlow — the one implementation of "pay this person".
 *
 * Lifted out of TipDialog so the modal and the public /pay/<username> page run
 * the SAME flow: check the recipient can actually receive → pick an amount →
 * mint an invoice against their own wallet → watch it settle. A payment path
 * is the last thing that should exist twice, and a second copy would inevitably
 * drift on the parts that matter (bounds, polling, expiry handling).
 *
 * A payer who is signed in with a wallet connected gets one more door into the
 * same flow: "Pay from my wallet" pays the invoice without leaving. The state
 * lives in usePayFlow; this file only draws it.
 *
 * Non-custodial throughout: the invoice is minted from the recipient's wallet
 * and the funds never touch OrangeCat.
 */

import { Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MoneyReceipt } from '@/components/money/MoneyReceipt';
import { PayCodeStep, PayExpiredStep } from '@/components/payment/PaySteps';
import { AmountField } from '@/components/money/AmountField';
import { isAmountInRange } from '@/components/money/amount-draft';
import { usePayFlow } from '@/components/payment/usePayFlow';
import { useSendCapability } from '@/hooks/useSendCapability';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { SEND_COPY } from '@/config/send';
import { TIP_COPY, TIP_MAX_BTC, TIP_MIN_BTC } from '@/config/tips';

export type { PayFlowState } from '@/components/payment/usePayFlow';

/** The words around the one pay machine. Tips and the public page are not the same sentence. */
interface PayWords {
  noWallet: (name: string) => string;
  paidTitle: string;
  paidBody: (name: string) => string;
  expiredTitle: string;
  expiredBody: string;
  again: string;
  scan: string;
  disclaimer: string;
  generating: string;
  generate: string;
  /** The generate action when "pay from my wallet" sits above it. */
  generateOther?: string;
  payFromWallet: string;
  payFromWalletNote: string;
  payingFromWallet: string;
  confirming: string;
  walletDeclined: (reason: string) => string;
  /**
   * The one action's label once an amount is entered ("Pay CHF 20"), and
   * before ("Enter an amount"). Omit both to keep `generate` throughout.
   */
  payAmount?: (amount: string) => string;
  enterAmount?: string;
}

interface PayFlowProps {
  username: string;
  recipientName: string;
  /** Re-runs the receive check when this flips true (modal open, page mount). */
  active?: boolean;
  /**
   * The receive check already done on the server, so the page can render the
   * amount field immediately instead of opening on a spinner. Omit it (the
   * modal case) and the check runs on the client as before.
   */
  initialCanReceive?: boolean;
  /** Suggested amount from a pay link — the payer can still change it. */
  initialAmountBtc?: number;
  /** The payment request this link came from, so the payment can answer it. */
  requestId?: string;
  /** Rendered above the amount input; the "what is this for" from the link. */
  noteSlot?: React.ReactNode;
  /** The same reason in words, for the receipt's "For" row. */
  receiptNote?: string | null;
  /** Extra content under the amount input (e.g. a link-prefill warning). */
  beforeActionSlot?: React.ReactNode;
  /** Shown alongside the confirmation — lets a modal offer "Done". */
  renderDone?: (reset: () => void) => React.ReactNode;
  /** The amount as the payer types it, so a page can offer other ways to pay it. */
  onAmountChange?: (amountBtc: number) => void;
  /** Defaults to tip wording. The public pay page passes its own. */
  words?: PayWords;
}

function Waiting({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-fg-tertiary" aria-hidden="true" />
      <p className="text-sm text-fg-secondary">{children}</p>
    </div>
  );
}

export function PayFlow({
  username,
  recipientName,
  active = true,
  initialCanReceive,
  initialAmountBtc,
  requestId,
  noteSlot,
  receiptNote,
  beforeActionSlot,
  renderDone,
  onAmountChange,
  words = TIP_COPY,
}: PayFlowProps) {
  const flow = usePayFlow({
    username,
    active,
    initialCanReceive,
    initialAmountBtc,
    requestId,
    onAmountChange,
  });
  const canPayFromWallet = useSendCapability();
  const { formatAmountBtc } = useDisplayCurrency();
  const { invoice, settleState, reset } = flow;

  if (flow.checkingWallet) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-fg-tertiary" />
      </div>
    );
  }

  if (flow.canReceive === false) {
    return (
      <p className="rounded-md border border-subtle bg-surface-raised/40 px-4 py-6 text-center text-sm text-fg-secondary">
        {words.noWallet(recipientName)}
      </p>
    );
  }

  if (invoice && settleState === 'paid') {
    return (
      <MoneyReceipt
        title={words.paidTitle}
        amountBtc={invoice.amountBtc}
        counterparty={recipientName}
        note={receiptNote}
        fallbackBody={words.paidBody(recipientName)}
      >
        {renderDone?.(reset)}
      </MoneyReceipt>
    );
  }

  if (invoice && settleState === 'expired') {
    return (
      <PayExpiredStep
        title={words.expiredTitle}
        body={words.expiredBody}
        againLabel={words.again}
        onAgain={reset}
      />
    );
  }

  // The wallet is paying, or has paid and settlement is being confirmed. The
  // code would only flash past here, so it stays out of sight.
  if (flow.paying) {
    return <Waiting>{words.payingFromWallet}</Waiting>;
  }
  if (flow.paidFromWallet) {
    return <Waiting>{words.confirming}</Waiting>;
  }

  // A timeout is not a "no": the wallet may still be paying THIS invoice. It
  // stays watched, and nothing here offers a second payment — a retry would
  // mint a new invoice and be one. If it settles the receipt appears; if it
  // never does, the invoice expires and the screen above offers a fresh start.
  if (invoice && flow.unconfirmed) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Clock className="h-12 w-12 text-status-warning" aria-hidden="true" />
        <p className="font-heading text-xl font-semibold tracking-display text-fg-primary">
          {SEND_COPY.unconfirmedTitle}
        </p>
        <p className="max-w-xs text-sm text-fg-secondary">{SEND_COPY.unconfirmedBody}</p>
        <p className="flex items-center gap-2 text-xs text-fg-tertiary">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {words.scan}
        </p>
      </div>
    );
  }

  if (invoice) {
    return (
      <PayCodeStep
        qrData={invoice.qrData}
        methodLabel={invoice.methodLabel}
        amountBtc={invoice.amountBtc}
        expiresInSeconds={invoice.expiresInSeconds ?? undefined}
        // What the payment is for stays on the step where the payer decides.
        note={
          <>
            {flow.walletNote && (
              <p className="rounded-md border border-status-warning/40 bg-status-warning-subtle px-3 py-2 text-sm text-fg-secondary">
                {words.walletDeclined(flow.walletNote)}
              </p>
            )}
            {noteSlot}
          </>
        }
        waitingLabel={words.scan}
        custodyLine={words.disclaimer}
        backLabel={words.again}
        onBack={reset}
      >
        {renderDone?.(reset)}
      </PayCodeStep>
    );
  }

  // The field's own bounds: a button is never live under its red line.
  const amountReady = isAmountInRange(flow.amount, TIP_MIN_BTC, TIP_MAX_BTC);
  const notReady = flow.generating || !amountReady;
  const generateLabel = flow.generating
    ? words.generating
    : !words.payAmount
      ? words.generate
      : amountReady
        ? words.payAmount(formatAmountBtc(flow.amount))
        : (words.enterAmount ?? words.generate);

  return (
    <div className="space-y-4">
      {noteSlot}
      <AmountField
        value={flow.amount}
        onChange={flow.changeAmount}
        minBtc={TIP_MIN_BTC}
        maxBtc={TIP_MAX_BTC}
      />
      {beforeActionSlot}
      {flow.error && <p className="text-sm text-status-negative">{flow.error}</p>}
      <p className="text-center text-xs text-fg-tertiary">{words.disclaimer}</p>
      {canPayFromWallet ? (
        // One primary action: paying from the wallet in hand. The code is the
        // other way, for a different wallet — quiet, but one tap away.
        <>
          <Button
            variant="primary"
            className="w-full"
            onClick={flow.payFromWallet}
            disabled={notReady}
          >
            {words.payFromWallet}
          </Button>
          <p className="-mt-2 text-center text-xs text-fg-tertiary">{words.payFromWalletNote}</p>
          <Button
            variant="outline"
            className="w-full"
            onClick={flow.generate}
            disabled={notReady}
            isLoading={flow.generating}
          >
            {flow.generating ? words.generating : (words.generateOther ?? words.generate)}
          </Button>
        </>
      ) : (
        // Orange only once it can act: the not-yet state is the monochrome
        // disabled button, never a dimmed orange slab.
        <Button
          variant={amountReady ? 'accent' : 'primary'}
          className="w-full"
          onClick={flow.generate}
          disabled={notReady}
          isLoading={flow.generating}
        >
          {generateLabel}
        </Button>
      )}
    </div>
  );
}
