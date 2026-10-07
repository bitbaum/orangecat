import { Info } from 'lucide-react';
import type { SharedWalletUsage } from '@/domain/wallets/walletUsage';

/**
 * Backer-facing shared-wallet disclosure, shown next to a revealed receiving
 * address. Bare count only — sibling entities are never named (see
 * walletUsage.ts for why). Renders nothing when there is nothing to disclose
 * or when payments derive a fresh address each time (xpub wallets).
 */
export function SharedWalletNotice({
  usage,
  method,
}: {
  usage: SharedWalletUsage | null;
  /** The rail the address belongs to. Linkability is an on-chain property: a
   *  Lightning address shows no payment on a public ledger, so the warning
   *  used to tell Lightning payers something untrue. */
  method: 'onchain' | 'lightning_address';
}) {
  if (!usage || usage.fresh_address_per_payment) {
    return null;
  }
  if (usage.shared_count === 0 && !usage.is_owner_default) {
    return null;
  }

  const sharedLine =
    usage.shared_count > 0
      ? `This wallet also receives funds for ${usage.shared_count} other ${
          usage.shared_count === 1 ? 'page' : 'pages'
        } on OrangeCat.`
      : 'This is the recipient’s default wallet — their other pages may share it.';

  return (
    <p className="flex items-start gap-1.5 text-xs text-fg-secondary">
      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
      <span>
        {sharedLine}
        {method === 'onchain' &&
          ' Payments to a shared on-chain address are publicly linkable on the blockchain.'}
      </span>
    </p>
  );
}
