'use client';

import { Check } from 'lucide-react';
import { WALLET_CATEGORIES, type Wallet } from '@/types/wallet';
import { truncateAddress } from '@/utils/string';

interface WalletCardProps {
  wallet: Wallet;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

export function WalletCard({ wallet, selected, onSelect, disabled }: WalletCardProps) {
  const categoryInfo = WALLET_CATEGORIES[wallet.category] || WALLET_CATEGORIES.general;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`relative w-full text-left p-3 rounded-lg border-2 transition-all ${
        selected
          ? 'border-fg-primary bg-surface-raised/40 ring-1 ring-fg-primary/20'
          : 'border-default hover:border-strong dark:hover:border-default'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {selected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-fg-primary flex items-center justify-center">
          <Check className="w-3 h-3 text-fg-inverted" />
        </div>
      )}
      <div className="flex items-start gap-2">
        <span className="text-lg">{categoryInfo.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{wallet.label}</div>
          <div className="text-xs text-fg-secondary mt-0.5 font-mono truncate">
            {wallet.address_or_xpub
              ? truncateAddress(wallet.address_or_xpub)
              : wallet.lightning_address || 'Connected'}
          </div>
        </div>
      </div>
    </button>
  );
}
