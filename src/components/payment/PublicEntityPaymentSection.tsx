/**
 * PublicEntityPaymentSection — Replaces static PublicEntityCTA on entity pages
 *
 * Shows contextual UI based on auth/ownership state:
 * - Not logged in: pay without an account (support, a purchase that is a real
 *   order, or a ticket bought by name)
 * - A listing that is booked first (a service): no purchase here at all — the
 *   page leads with Book and the payment is asked for on the accepted booking
 * - Logged in, IS the seller: SellerWalletBanner (prompt to connect wallet)
 * - Logged in, NOT the seller: PaymentButton (opens PaymentDialog)
 */

'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useSellerPaymentMethods } from '@/hooks/useSellerPaymentMethods';
import { PaymentButton } from './PaymentButton';
import { PaymentExpectationNote } from './PaymentExpectationNote';
import { SellerWalletBanner } from './SellerWalletBanner';
import { OwnerCollectPanel } from './OwnerCollectPanel';
import { GuestPurchasePanel } from './GuestPurchasePanel';
import { PublicSupportPanel } from './PublicSupportPanel';
import { OptionalSupportPanel } from './OptionalSupportPanel';
import { NoWalletYetNotice } from './NoWalletYetNotice';
import GuestTicketPurchase from '@/components/events/GuestTicketPurchase';
import type { ContributionBoundsBtc } from '@/config/contribution-terms';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import { isBookedBeforePaid } from '@/config/payment-flow';
import { inquiryHref } from '@/features/messaging/lib/draft';

interface PublicEntityPaymentSectionProps {
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  /** Who receives the money (the owner's name), for the support card's words. */
  recipientName?: string | null;
  /** Price amount in the entity's own currency (for fixed_price entities) */
  priceAmount?: number;
  /** Currency the price is denominated in (e.g. 'CHF'); 'BTC'/omitted → BTC */
  priceCurrency?: string;
  /** Seller's profile/actor ID for wallet lookup (null if no seller found) */
  sellerProfileId: string | null;
  /** Seller's auth.users ID for self-purchase detection (null if no seller found) */
  sellerUserId: string | null;
  /**
   * Seller's public receiving info, resolved server-side (no secrets): whether
   * a payment can reach them at all. `address` is null for NWC-only sellers.
   */
  sellerReceive: { method: 'nwc' | 'lightning_address' | 'onchain'; address: string | null } | null;
  /** An investment's stated minimum/maximum, in BTC (src/config/contribution-terms.ts). */
  contributionBounds?: ContributionBoundsBtc | null;
  /** Redirect path after sign-in */
  signInRedirect: string;
  /** The support card's title when the entity itself is supported ("Support Mira"). */
  supportTitle?: string;
}

export function PublicEntityPaymentSection({
  entityType,
  entityId,
  entityTitle,
  recipientName = null,
  priceAmount,
  priceCurrency,
  sellerProfileId,
  sellerUserId,
  sellerReceive,
  contributionBounds = null,
  signInRedirect,
  supportTitle,
}: PublicEntityPaymentSectionProps) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const meta = getEntityMetadata(entityType);
  // Use sellerUserId (auth.users ID) for wallet lookup — wallets are keyed by profile_id = auth user ID
  // sellerProfileId may be an actor ID for actor-owned entities, which won't match wallet.profile_id
  const { hasWallet, loading: walletLoading } = useSellerPaymentMethods(sellerUserId);
  // A ticket needs a holder the door can scan. Paying the organizer's bare
  // address would take the money and leave no ticket, so a priced event never
  // shows it: signed out, the guest buys by name (the invoice carries it and
  // settlement issues the ticket); signed in, the ticket lands in the account.
  const isTicket = entityType === 'event' && !!priceAmount;
  const bookedFirst = isBookedBeforePaid(entityType);

  // No wallet a payment can reach: say so, and give the visitor the one thing
  // that still moves them forward — a message to the owner about this listing,
  // through sign-in when needed. A bare sentence here was a dead end under a
  // price and a stock count.
  const noWalletNotice = (
    <NoWalletYetNotice payee={recipientName || undefined}>
      {sellerUserId && (
        <Button
          variant="primary"
          className="mt-4 w-full min-h-11"
          // Signed out, the middleware sends this through sign-in and back.
          href={inquiryHref(sellerUserId, { title: entityTitle, path: signInRedirect })}
        >
          Ask how to pay
        </Button>
      )}
    </NoWalletYetNotice>
  );

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

  // Not logged in — permissionless by default: anyone can pay without an
  // account, through a code minted on the seller's own wallet. An honest
  // notice stands in when the seller has no wallet at all.
  if (!isAuthenticated) {
    if (meta.canReceiveSupport && meta.paymentPattern !== 'fixed_price') {
      return sellerReceive ? (
        <PublicSupportPanel
          entityType={entityType}
          entityId={entityId}
          entityTitle={entityTitle}
          recipientName={recipientName}
          bounds={contributionBounds}
          title={supportTitle}
        />
      ) : (
        noWalletNotice
      );
    }

    const optionalSupport = sellerReceive && meta.canReceiveSupport && (
      <OptionalSupportPanel
        entityType={entityType}
        entityId={entityId}
        entityTitle={entityTitle}
        recipientName={recipientName}
      />
    );

    // Booked first, paid once the provider accepts: the page's one action is
    // Book (in the lead), so there is no purchase here, with or without a wallet.
    if (bookedFirst) {
      return optionalSupport || null;
    }

    // A purchase without an account is a real order: a code for exactly the
    // price, minted on the seller's wallet (any kind of wallet, since the
    // server mints it), and the order the seller sees.
    if (!isTicket && sellerReceive && priceAmount) {
      return (
        <div className="space-y-4">
          <GuestPurchasePanel
            entityType={entityType}
            entityId={entityId}
            entityTitle={entityTitle}
            recipientName={recipientName}
            priceAmount={priceAmount}
            priceCurrency={priceCurrency}
            signInHref={`${ROUTES.AUTH}?mode=login&from=${signInRedirect}`}
          />
          {optionalSupport}
        </div>
      );
    }

    if (isTicket && sellerReceive) {
      return (
        <div className="space-y-4">
          <GuestTicketPurchase eventId={entityId} eventPath={ROUTES.EVENTS.VIEW(entityId)} />
          {meta.canReceiveSupport && (
            <OptionalSupportPanel
              entityType={entityType}
              entityId={entityId}
              entityTitle={entityTitle}
              recipientName={recipientName}
            />
          )}
        </div>
      );
    }

    // No wallet: say so, with the message to the owner. A wallet but no price
    // (or a ticket with no wallet resolved above): nothing to buy here.
    return !sellerReceive ? noWalletNotice : optionalSupport || null;
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

  // Booked first, paid once the provider accepts (the booking carries the
  // payment): no purchase on the page, only the optional extra support.
  if (bookedFirst) {
    return hasWallet && meta.canReceiveSupport ? (
      <OptionalSupportPanel
        entityType={entityType}
        entityId={entityId}
        entityTitle={entityTitle}
        recipientName={recipientName}
      />
    ) : null;
  }

  // Logged in, NOT the seller, seller has no wallet — no purchase CTA. A greyed
  // "No wallet connected" button promised an action that could never complete;
  // say the true thing instead.
  if (!hasWallet) {
    return noWalletNotice;
  }

  if (meta.paymentPattern === 'none') {
    return meta.canReceiveSupport ? (
      <PublicSupportPanel
        entityType={entityType}
        entityId={entityId}
        entityTitle={entityTitle}
        recipientName={recipientName}
        title={supportTitle}
      />
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
            recipientName={recipientName}
            sellerHasWallet={hasWallet}
            contributionBounds={contributionBounds}
            className="w-full min-h-11"
          />
          <PaymentExpectationNote />
        </CardContent>
      </Card>
      {meta.canReceiveSupport && meta.paymentPattern === 'fixed_price' && (
        <OptionalSupportPanel
          entityType={entityType}
          entityId={entityId}
          entityTitle={entityTitle}
          recipientName={recipientName}
        />
      )}
    </div>
  );
}
