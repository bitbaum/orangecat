/**
 * PaymentDialog — Full payment flow modal
 *
 * Phases: Confirm → QR code → Waiting → Success
 * Handles both fixed_price (buy) and contribution (support) flows.
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
import { PaymentQRCode } from './PaymentQRCode';
import { PaymentStatusIndicator } from './PaymentStatusIndicator';
import { AmountField } from '@/components/money/AmountField';
import { usePaymentFlow } from '@/hooks/usePaymentFlow';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { CheckCircle2, Loader2 } from 'lucide-react';

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
  /** Seed the contribution amount picker (e.g. wishlist tier target) */
  defaultAmount?: number;
}

import { DEFAULT_CONTRIBUTION_BTC } from '@/config/payment-presets';
import { PAY_MAX_BTC, PAY_MIN_BTC } from '@/config/pay';

export function PaymentDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityTitle,
  priceBtc,
  priceCurrency,
  defaultAmount,
}: PaymentDialogProps) {
  const meta = getEntityMetadata(entityType);
  const isContribution = meta.paymentPattern === 'contribution';
  const { formatAmountBtc, formatPrice } = useDisplayCurrency();

  const { state, initiate, confirmPaid, reset, isLoading } = usePaymentFlow();

  // Contribution-specific state
  const [contributionAmount, setContributionAmount] = useState(
    defaultAmount ?? DEFAULT_CONTRIBUTION_BTC
  );
  // Sync the picker when a new defaultAmount arrives (e.g. user clicked a
  // different wishlist tier on the parent). Initial-state seeding only
  // catches the first mount.
  useEffect(() => {
    if (defaultAmount !== undefined) {
      setContributionAmount(defaultAmount);
    }
  }, [defaultAmount]);
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
    setContributionAmount(defaultAmount ?? DEFAULT_CONTRIBUTION_BTC);
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
  const hasValidAmount = isContribution ? contributionAmount > 0 : fixedPrice > 0;
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
            {isContribution ? 'Support' : 'Buy'} {entityTitle}
          </DialogTitle>
          <DialogDescription>
            {isContribution
              ? `Choose an amount to support this ${meta.name.toLowerCase()}`
              : `Pay ${priceLabel}`}
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
                    minBtc={PAY_MIN_BTC}
                    maxBtc={PAY_MAX_BTC}
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
                className="w-full min-h-11"
              >
                {isContribution ? `Support with ${priceLabel}` : `Pay ${priceLabel}`}
              </Button>
            </>
          )}

          {/* Phase: Initiating */}
          {state.phase === 'initiating' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-fg-tertiary" />
              <p className="text-sm text-fg-secondary">Creating invoice...</p>
            </div>
          )}

          {/* Phase: Awaiting Payment */}
          {state.phase === 'awaiting_payment' && (
            <div className="flex flex-col items-center gap-4">
              <PaymentQRCode
                qrData={state.data.qr_data}
                methodLabel={state.data.method_label}
                amountBtc={state.data.payment_intent.amount_btc}
                expiresInSeconds={state.data.expires_in_seconds ?? undefined}
              />

              <PaymentStatusIndicator status="invoice_ready" />

              {/* "I've paid" fallback ONLY for a bare Lightning address (no LUD-21
                  verify URL) — the single rail we can't auto-detect. NWC,
                  verify-capable Lightning addresses, and on-chain are confirmed
                  automatically and the server refuses manual confirmation for them.
                  Keep in sync with buyerConfirmPayment's guard. */}
              {state.data.payment_intent.payment_method === 'lightning_address' &&
                !state.data.payment_intent.lnurl_verify_url && (
                  <Button variant="outline" size="sm" onClick={confirmPaid} className="min-h-11">
                    I&apos;ve paid
                  </Button>
                )}
              {state.notice && (
                <p role="status" className="text-sm text-fg-secondary text-center">
                  {state.notice}
                </p>
              )}
            </div>
          )}

          {/* Phase: Success */}
          {state.phase === 'success' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 className="h-12 w-12 text-status-positive" />
              <p className="text-lg font-semibold text-status-positive">Payment successful!</p>
              <p className="text-sm text-fg-secondary">
                {isContribution ? 'Thank you for your support!' : 'Your order has been placed.'}
              </p>
              <Button onClick={handleClose} className="min-h-11">
                Done
              </Button>
            </div>
          )}

          {/* Phase: Claimed — the buyer's word, awaiting the seller's check */}
          {state.phase === 'claimed' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-fg-secondary" />
              <p className="text-lg font-semibold text-fg-primary">Thanks — noted</p>
              <p className="text-sm text-fg-secondary">
                The seller confirms once it shows in their wallet. You don&apos;t need to pay again.
              </p>
              <Button onClick={handleClose} className="min-h-11">
                Done
              </Button>
            </div>
          )}

          {/* Phase: Expired */}
          {state.phase === 'expired' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <PaymentStatusIndicator status="expired" />
              <p className="text-sm text-fg-secondary">
                The invoice has expired. Please try again.
              </p>
              <Button onClick={reset} variant="outline" className="min-h-11">
                Try Again
              </Button>
            </div>
          )}

          {/* Phase: Error */}
          {state.phase === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <PaymentStatusIndicator status="failed" />
              <p className="text-sm text-status-negative">{state.message}</p>
              <Button onClick={reset} variant="outline" className="min-h-11">
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
