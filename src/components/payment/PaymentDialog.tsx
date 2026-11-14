/**
 * PaymentDialog — a signed-in payment for a listing, in the one flow.
 *
 * Amount → code → paid / expired / failed, in the words and steps every
 * payment shares (src/config/payment-flow.ts, PaymentFlowSteps). Handles
 * fixed_price (a purchase, which is also an order) and contribution flows:
 * support, or for an investment, investing on its stated terms
 * (src/config/contribution-terms.ts).
 */

'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { PaymentFlowSteps } from './PaymentFlowSteps';
import { AmountField } from '@/components/money/AmountField';
import { usePaymentFlow } from '@/hooks/usePaymentFlow';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import {
  CONTRIBUTION_TERMS,
  breachedBound,
  contributionRange,
  type ContributionBoundsBtc,
} from '@/config/contribution-terms';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { useChosenAmountBtc } from '@/components/money/useOpeningAmountBtc';
import { PAYMENT_FLOW_COPY, payeeLine, type PaymentAct } from '@/config/payment-flow';
import { ROUTES } from '@/config/routes';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  entityId: string;
  /** Entity title for display */
  entityTitle: string;
  /** Price amount in the entity's own currency (for fixed_price entities) */
  priceBtc?: number;
  /** Currency the price is denominated in (e.g. 'CHF'); 'BTC'/omitted → BTC */
  priceCurrency?: string;
  /** Seller's profile ID (for checking wallet availability) */
  sellerProfileId?: string;
  /** Who is paid (the owner's name): named before the money moves and on the receipt. */
  recipientName?: string | null;
  /** Seed the contribution amount picker (e.g. wishlist tier target) */
  defaultAmount?: number;
  /** An investment's stated minimum/maximum, in BTC (src/config/contribution-terms.ts). */
  contributionBounds?: ContributionBoundsBtc | null;
}

export function PaymentDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityTitle,
  priceBtc,
  priceCurrency,
  recipientName = null,
  defaultAmount,
  contributionBounds = null,
}: PaymentDialogProps) {
  const meta = getEntityMetadata(entityType);
  const isContribution = meta.paymentPattern === 'contribution';
  const terms = CONTRIBUTION_TERMS[entityType];
  const range = contributionRange(contributionBounds);
  const { formatAmountBtc, formatPrice } = useDisplayCurrency();

  const flow = usePaymentFlow();
  const { state, initiate, reset, isLoading } = flow;
  const act: PaymentAct = !isContribution ? 'pay' : terms ? 'invest' : 'support';

  const [contributionAmount, setContributionAmount] = useChosenAmountBtc(range, defaultAmount);
  // A new defaultAmount (another wishlist tier picked on the parent) re-seeds the picker.
  useEffect(() => {
    if (defaultAmount !== undefined) {
      setContributionAmount(defaultAmount);
    }
  }, [defaultAmount, setContributionAmount]);
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  // Message + anonymous are optional — keep them one tap away so the default
  // path is just amount → pay (fewer decisions, shortest path to support).
  const [showMore, setShowMore] = useState(false);

  const handleClose = () => {
    reset();
    setMessage('');
    setIsAnonymous(false);
    setShowMore(false);
    setContributionAmount(defaultAmount ?? null);
    onOpenChange(false);
  };

  const handleInitiate = () => {
    initiate({
      entity_type: entityType,
      entity_id: entityId,
      amount_btc: isContribution ? contributionAmount : undefined,
      message: isContribution ? message || undefined : undefined,
      is_anonymous: isContribution ? isAnonymous : undefined,
    });
  };

  // Fixed-price entities are priced in their own currency (priceBtc carries that
  // amount, priceCurrency the unit); contributions are chosen in BTC. The server
  // re-derives the BTC charge authoritatively — this only drives display + gating.
  const fixedPrice = priceBtc ?? 0;
  const hasValidAmount = isContribution
    ? contributionAmount > 0 && !breachedBound(contributionAmount, contributionBounds)
    : fixedPrice > 0;
  const priceLabel = isContribution
    ? formatAmountBtc(contributionAmount)
    : formatPrice(fixedPrice, priceCurrency);

  // Prevent accidental dismissal while a payment is in flight
  const isPaymentActive = state.phase === 'initiating' || state.phase === 'awaiting_payment';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={isPaymentActive ? e => e.preventDefault() : undefined}
        onEscapeKeyDown={isPaymentActive ? e => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle>
            {isContribution ? (terms ? `${terms.verb} in` : 'Support') : 'Buy'} {entityTitle}
          </DialogTitle>
          <DialogDescription>
            {terms
              ? `Choose an amount to ${terms.verb.toLowerCase()} on the terms on this page. `
              : ''}
            {payeeLine(recipientName, entityTitle)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Phase: Idle / Confirm */}
          {state.phase === 'idle' && (
            <>
              {isContribution && (
                <div className="space-y-4">
                  <AmountField
                    value={contributionAmount}
                    onChange={setContributionAmount}
                    minBtc={range.minBtc}
                    maxBtc={range.maxBtc}
                  />
                  {showMore ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-fg-primary">
                          Message (optional)
                        </label>
                        <Textarea
                          value={message}
                          onChange={e => setMessage(e.target.value)}
                          placeholder="Leave a message of support..."
                          rows={2}
                          className="mt-1"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isAnonymous}
                          onChange={e => setIsAnonymous(e.target.checked)}
                          className="rounded border-strong"
                        />
                        Contribute anonymously
                      </label>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowMore(true)}
                      className="text-sm text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
                    >
                      Add a message or give anonymously
                    </button>
                  )}
                </div>
              )}

              <Button
                onClick={handleInitiate}
                disabled={isLoading || !hasValidAmount}
                className="w-full"
              >
                {hasValidAmount || !isContribution
                  ? PAYMENT_FLOW_COPY.action(act, priceLabel)
                  : PAYMENT_FLOW_COPY.enterAmount}
              </Button>
              <p className="mb-0 text-center text-xs text-fg-tertiary">
                {PAYMENT_FLOW_COPY.custody}
              </p>
            </>
          )}

          <PaymentFlowSteps
            flow={flow}
            fixedAmount={!isContribution}
            payeeName={recipientName}
            forWhat={entityTitle}
          >
            {!isContribution && state.phase === 'success' && (
              // A purchase is an order: the receipt leads to the record of it.
              <Button variant="outline" href={ROUTES.DASHBOARD.ORDERS}>
                {PAYMENT_FLOW_COPY.seeOrder}
              </Button>
            )}
            <Button onClick={handleClose}>{PAYMENT_FLOW_COPY.done}</Button>
          </PaymentFlowSteps>
        </div>
      </DialogContent>
    </Dialog>
  );
}
