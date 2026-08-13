/**
 * PublicEntityPaymentSection — Replaces static PublicEntityCTA on entity pages
 *
 * Shows contextual UI based on auth/ownership state:
 * - Not logged in: "Sign in to buy/support" CTA
 * - Logged in, IS the seller: SellerWalletBanner (prompt to connect wallet)
 * - Logged in, NOT the seller: PaymentButton (opens PaymentDialog)
 */

'use client';

import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useSellerPaymentMethods } from '@/hooks/useSellerPaymentMethods';
import { PaymentButton } from './PaymentButton';
import { PaymentExpectationNote } from './PaymentExpectationNote';
import { SellerWalletBanner } from './SellerWalletBanner';
import { OwnerCollectPanel } from './OwnerCollectPanel';
import { PublicPayPanel } from './PublicPayPanel';
import { PublicSupportPanel } from './PublicSupportPanel';
import { SharedWalletNotice } from './SharedWalletNotice';
import type { SharedWalletUsage } from '@/domain/wallets/walletUsage';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import { authLoginPath } from '@/lib/navigation/safe-return-path';

interface PublicEntityPaymentSectionProps {
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  /** Price amount in the entity's own currency (for fixed_price entities) */
  priceAmount?: number;
  /** Currency the price is denominated in (e.g. 'CHF'); 'BTC'/omitted → BTC */
  priceCurrency?: string;
  /** Seller's profile/actor ID for wallet lookup (null if no seller found) */
  sellerProfileId: string | null;
  /** Seller's auth.users ID for self-purchase detection (null if no seller found) */
  sellerUserId: string | null;
  /**
   * Seller's public receiving info, resolved server-side (no secrets). Drives
   * the anonymous pay-direct panel. `address` is null for NWC-only sellers.
   */
  sellerReceive: { method: 'nwc' | 'lightning_address' | 'onchain'; address: string | null } | null;
  /**
   * How shared the resolved receiving wallet is (resolved server-side).
   * Drives the backer-facing address-reuse disclosure next to the address.
   */
  sharedWalletUsage?: SharedWalletUsage | null;
  /** Fixed price converted to BTC, for the anonymous BIP21 amount. */
  priceAmountBtc?: number;
  /** Redirect path after sign-in */
  signInRedirect: string;
}

export function PublicEntityPaymentSection({
  entityType,
  entityId,
  entityTitle,
  priceAmount,
  priceCurrency,
  sellerProfileId,
  sellerUserId,
  sellerReceive,
  sharedWalletUsage = null,
  priceAmountBtc,
  signInRedirect,
}: PublicEntityPaymentSectionProps) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const meta = getEntityMetadata(entityType);
  // Use sellerUserId (auth.users ID) for wallet lookup — wallets are keyed by profile_id = auth user ID
  // sellerProfileId may be an actor ID for actor-owned entities, which won't match wallet.profile_id
  const { hasWallet, loading: walletLoading } = useSellerPaymentMethods(sellerUserId);

  // Auth still hydrating — show skeleton to avoid flash
  if (authLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <div className="h-11 w-full animate-pulse rounded-md bg-surface-raised" />
        </CardContent>
      </Card>
    );
  }

  // Not logged in — permissionless by default: let anyone pay direct to the
  // seller's public address (no account). Falls back to sign-in only when there
  // is no static address to reveal (NWC-only seller), and to an honest notice
  // when the seller has no wallet at all.
  if (!isAuthenticated) {
    if (meta.canReceiveSupport && meta.paymentPattern !== 'fixed_price') {
      return sellerReceive ? (
        <PublicSupportPanel
          entityType={entityType}
          entityId={entityId}
          entityTitle={entityTitle}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-fg-secondary text-center">
              This creator hasn&apos;t connected a wallet yet.
            </p>
          </CardContent>
        </Card>
      );
    }

    if (
      sellerReceive?.address &&
      (sellerReceive.method === 'onchain' || sellerReceive.method === 'lightning_address')
    ) {
      return (
        <div className="space-y-4">
          <PublicPayPanel
            entityTitle={entityTitle}
            isContribution={meta.paymentPattern === 'contribution'}
            priceAmount={priceAmount}
            priceCurrency={priceCurrency}
            amountBtc={priceAmountBtc}
            method={sellerReceive.method}
            address={sellerReceive.address}
            signInHref={authLoginPath(signInRedirect)}
          />
          <SharedWalletNotice usage={sharedWalletUsage} />
          {meta.canReceiveSupport && meta.paymentPattern === 'fixed_price' && (
            <PublicSupportPanel
              entityType={entityType}
              entityId={entityId}
              entityTitle={entityTitle}
            />
          )}
        </div>
      );
    }

    const purchaseFallback = (
      <Card>
        <CardContent className="pt-6 space-y-3">
          {!sellerReceive ? (
            <p className="text-sm text-fg-secondary text-center">
              This creator hasn&apos;t connected a wallet yet.
            </p>
          ) : (
            <>
              <Link href={authLoginPath(signInRedirect)} className="block">
                <Button className="w-full gap-2 min-h-11">
                  <LogIn className="w-4 h-4" />
                  Sign in to purchase
                </Button>
              </Link>
              <p className="text-xs text-fg-secondary text-center">
                This seller uses a connected Lightning wallet for purchases.
              </p>
              <PaymentExpectationNote />
            </>
          )}
        </CardContent>
      </Card>
    );
    return sellerReceive && meta.canReceiveSupport && meta.paymentPattern === 'fixed_price' ? (
      <div className="space-y-4">
        {purchaseFallback}
        <PublicSupportPanel
          entityType={entityType}
          entityId={entityId}
          entityTitle={entityTitle}
        />
      </div>
    ) : (
      purchaseFallback
    );
  }

  // Wait for wallet check before determining owner vs buyer UI
  if (walletLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <div className="h-11 w-full animate-pulse rounded-md bg-surface-raised" />
        </CardContent>
      </Card>
    );
  }

  // Logged in, IS the seller — show the owner-facing collect panel.
  // Prompts to connect a wallet when none is set; otherwise shows which address
  // receives funds plus share/QR so the owner can get paid.
  const isOwner = !!sellerUserId && user?.id === sellerUserId;
  if (isOwner) {
    if (!hasWallet) {
      return <SellerWalletBanner isOwner={true} hasWallet={hasWallet} />;
    }
    return (
      <OwnerCollectPanel
        entityType={entityType}
        entityId={entityId}
        entityTitle={entityTitle}
        priceAmount={priceAmount}
        priceCurrency={priceCurrency}
      />
    );
  }

  // Logged in, NOT the seller, seller has no wallet — no purchase CTA. A greyed
  // "No wallet connected" button promised an action that could never complete;
  // say the true thing instead.
  if (!hasWallet) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-fg-secondary text-center">
            This creator hasn&apos;t connected a wallet yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (meta.paymentPattern === 'none') {
    return meta.canReceiveSupport ? (
      <PublicSupportPanel entityType={entityType} entityId={entityId} entityTitle={entityTitle} />
    ) : null;
  }

  // Logged in, NOT the seller — show payment button + what the payment means.
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <PaymentButton
            entityType={entityType}
            entityId={entityId}
            entityTitle={entityTitle}
            priceBtc={priceAmount}
            priceCurrency={priceCurrency}
            sellerProfileId={sellerProfileId ?? undefined}
            sellerHasWallet={hasWallet}
            className="w-full min-h-11"
          />
          <PaymentExpectationNote />
        </CardContent>
      </Card>
      {meta.canReceiveSupport && meta.paymentPattern === 'fixed_price' && (
        <PublicSupportPanel
          entityType={entityType}
          entityId={entityId}
          entityTitle={entityTitle}
        />
      )}
    </div>
  );
}
