import { detectWalletType, type Wallet } from '@/types/wallet';
import { truncateAddress } from '@/utils/string';

/**
 * How a wallet reads on a "Pay into" card: which rail the money arrives on,
 * where, and whether another of the person's wallets points at the same place.
 *
 * The card used to show a truncated label over a bare address. Two rows for
 * one Coinos account — "Coinos platform (fallback for broke…" and "Coinos
 * (NWC send + LN receive)", both orangecat@coinos.io — read as two wallets,
 * and nothing said they were the same account (2026-10-07).
 */
export type WalletRail = 'lightning' | 'onchain' | 'xpub';

export function walletRail(wallet: Pick<Wallet, 'address_or_xpub' | 'lightning_address'>): {
  rail: WalletRail;
  destination: string;
} {
  if (wallet.address_or_xpub) {
    const xpub = detectWalletType(wallet.address_or_xpub) === 'xpub';
    return xpub
      ? { rail: 'xpub', destination: 'a new address for every payment' }
      : { rail: 'onchain', destination: truncateAddress(wallet.address_or_xpub) };
  }
  return { rail: 'lightning', destination: wallet.lightning_address || 'connected wallet' };
}

export const RAIL_LABEL: Record<WalletRail, string> = {
  lightning: 'Lightning',
  onchain: 'Bitcoin',
  xpub: 'Bitcoin',
};

/** The receive address two rows would share, normalised for comparison. */
function receiveKey(wallet: Wallet): string | null {
  const key = wallet.lightning_address || wallet.address_or_xpub;
  return key ? key.trim().toLowerCase() : null;
}

/** For each wallet, the labels of the OTHER wallets that receive at the same place. */
export function sameDestinationAs(wallets: Wallet[]): Map<string, string[]> {
  const byKey = new Map<string, Wallet[]>();
  for (const w of wallets) {
    const k = receiveKey(w);
    if (k) {
      byKey.set(k, [...(byKey.get(k) ?? []), w]);
    }
  }
  const out = new Map<string, string[]>();
  for (const group of byKey.values()) {
    if (group.length < 2) {
      continue;
    }
    for (const w of group) {
      out.set(
        w.id,
        group.filter(o => o.id !== w.id).map(o => o.label)
      );
    }
  }
  return out;
}

/** Whether reusing this wallet links pages on the blockchain — only a plain
 *  on-chain address does. Lightning and xpub wallets do not. */
export function reuseIsPublicOnChain(wallet: Wallet | undefined): boolean {
  return !!wallet && walletRail(wallet).rail === 'onchain';
}
