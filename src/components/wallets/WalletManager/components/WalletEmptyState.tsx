/**
 * WALLET EMPTY STATE COMPONENT
 * Shown when no wallets exist
 */

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Wallet as WalletIcon, ExternalLink } from 'lucide-react';
import { ROUTES } from '@/config/routes';

interface WalletEmptyStateProps {
  isOwner: boolean;
  onAddClick: () => void;
}

export function WalletEmptyState({ isOwner, onAddClick }: WalletEmptyStateProps) {
  return (
    <>
      <div className="text-center py-12 border-2 border-dashed border-strong rounded-lg bg-surface-raised/40/50 dark:bg-surface-raised/50">
        <WalletIcon className="w-16 h-16 text-fg-tertiary mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-fg-primary mb-2">No wallets yet</h3>
        <p className="text-fg-secondary mb-4 max-w-md mx-auto">
          Add your first Bitcoin wallet to start receiving support.
        </p>
        {isOwner && (
          <Button onClick={onAddClick} variant="outline">
            Add Your First Wallet
          </Button>
        )}
      </div>
      {isOwner && (
        <div className="text-center">
          <Link
            href={ROUTES.WALLETS.LIST}
            className="text-sm text-fg-secondary hover:text-bitcoinOrange dark:hover:text-fg-primary transition-colors inline-flex items-center gap-1"
          >
            I don't have a wallet yet
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      )}
    </>
  );
}
