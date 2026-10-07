'use client';

import { Check } from 'lucide-react';
import { WALLET_CATEGORIES, type Wallet } from '@/types/wallet';
import { RAIL_LABEL, walletRail } from './wallet-display';

interface WalletCardProps {
  wallet: Wallet;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  /** Labels of the person's other wallets that receive at the same address. */
  sameAs?: string[];
}

export function WalletCard({ wallet, selected, onSelect, disabled, sameAs }: WalletCardProps) {
  const categoryInfo = WALLET_CATEGORIES[wallet.category] || WALLET_CATEGORIES.general;
  const { rail, destination } = walletRail(wallet);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
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
      <div className="flex items-start gap-2 pr-6">
        <span className="text-lg" aria-hidden>
          {categoryInfo.icon}
        </span>
        <div className="min-w-0 flex-1">
          {/* The whole name, on two lines if it needs them: a label cut at
              "fallback for broke…" was the one thing telling two rows apart. */}
          <div className="font-medium text-sm line-clamp-2 break-words">{wallet.label}</div>
          <div className="text-xs text-fg-secondary mt-0.5 truncate">
            {RAIL_LABEL[rail]} · <span className="font-mono">{destination}</span>
          </div>
          {sameAs && sameAs.length > 0 && (
            <div className="text-xs text-fg-tertiary mt-1 line-clamp-2">
              Same address as {sameAs.map(l => `“${l}”`).join(', ')}.
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
