/**
 * PaymentButton — "Buy Now" / "Support" button on entity pages
 *
 * Opens the PaymentDialog. Disabled if seller has no wallet.
 * Uses entity registry to determine button text and behavior.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Wallet } from 'lucide-react';
import { PaymentDialog } from './PaymentDialog';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import {
  CONTRIBUTION_TERMS,
  contributionRange,
  type ContributionBoundsBtc,
} from '@/config/contribution-terms';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';

interface PaymentButtonProps {
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  /** Price amount in the entity's own currency (for fixed_price entities) */
  priceBtc?: number;
  /** Currency the price is denominated in (e.g. 'CHF'); 'BTC'/omitted → BTC */
  priceCurrency?: string;
  /** Seller's profile ID */
  sellerProfileId?: string;
  /** Whether the seller has a wallet connected */
  sellerHasWallet?: boolean;
  /** An investment's stated minimum/maximum, in BTC — bounds the dialog's amount. */
  contributionBounds?: ContributionBoundsBtc | null;
  /** Additional CSS classes */
  className?: string;
}

export function PaymentButton({
  entityType,
  entityId,
  entityTitle,
  priceBtc,
  priceCurrency,
  sellerProfileId,
  sellerHasWallet = true,
  contributionBounds = null,
  className,
}: PaymentButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const meta = getEntityMetadata(entityType);
  const { formatPrice } = useDisplayCurrency();

  // Don't render for entities that aren't purchasable
  if (meta.paymentPattern === 'none') {
    return null;
  }

  const isContribution = meta.paymentPattern === 'contribution';
  // An investment is invested in, not supported (src/config/contribution-terms.ts).
  const buttonText = isContribution
    ? (CONTRIBUTION_TERMS[entityType]?.verb ?? 'Support')
    : 'Buy Now';
  // A minimum above what one payment can be cannot be met here (contributionRange).
  const unpayable = isContribution && contributionRange(contributionBounds).unpayable;
  const disabled = !sellerHasWallet || unpayable;

  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        disabled={disabled}
        className={className}
        size="lg"
      >
        <Wallet className="mr-2 h-4 w-4" />
        {unpayable
          ? 'Above the online payment limit'
          : disabled
            ? 'No wallet connected'
            : buttonText}
        {!isContribution && priceBtc && !disabled && (
          <span className="ml-1 opacity-75">({formatPrice(priceBtc, priceCurrency)})</span>
        )}
      </Button>

      <PaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entityType={entityType}
        entityId={entityId}
        entityTitle={entityTitle}
        priceBtc={priceBtc}
        priceCurrency={priceCurrency}
        sellerProfileId={sellerProfileId}
        contributionBounds={contributionBounds}
      />
    </>
  );
}
