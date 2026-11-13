/**
 * SellerWalletBanner — Prompts sellers to connect their wallet
 *
 * Shown on entity detail pages when the seller hasn't connected a wallet.
 * Only visible to the entity owner.
 */

'use client';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Wallet, AlertCircle } from 'lucide-react';
import { ROUTES } from '@/config/routes';

interface SellerWalletBannerProps {
  /** Whether the current user owns this entity */
  isOwner: boolean;
  /** Whether the seller has a wallet connected */
  hasWallet: boolean;
}

export function SellerWalletBanner({ isOwner, hasWallet }: SellerWalletBannerProps) {
  // Only show to the entity owner when they don't have a wallet
  if (!isOwner || hasWallet) {
    return null;
  }

  return (
    <Alert className="border-status-warning/20 bg-status-warning-subtle">
      <AlertCircle className="h-4 w-4 text-status-warning" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-status-warning">Connect your wallet to receive payments</p>
          <p className="text-sm text-status-warning">
            Buyers can&apos;t pay you until you connect a Bitcoin wallet.
          </p>
        </div>
        <Button size="sm" href={ROUTES.DASHBOARD.WALLETS} className="min-h-11 shrink-0">
          <Wallet className="mr-2 h-4 w-4" />
          Connect Wallet
        </Button>
      </div>
    </Alert>
  );
}
