/**
 * Point an entity form at a saved wallet row.
 *
 * Payment resolution reads `entity_wallets` via `_wallet_id`. The address
 * columns are still copied so pages that display them stay in sync. Writing
 * only the columns leaves the pay link unable to receive.
 *
 * An extended public key is never copied: `bitcoin_address` is public, and an
 * xpub on a public page reveals every address the wallet will ever use. It is
 * also not payable — the payer gets a freshly derived address from the
 * linked wallet instead.
 */

import { isExtendedPublicKey } from '@/lib/wallets/publicWallet';

export interface SelectableWallet {
  id: string;
  address_or_xpub: string | null;
  lightning_address: string | null;
}

export function applyWalletSelection(
  onFieldChange: (field: string, value: unknown) => void,
  wallet: SelectableWallet
): void {
  const onchain = wallet.address_or_xpub ?? '';
  onFieldChange('bitcoin_address', isExtendedPublicKey(onchain) ? '' : onchain);
  onFieldChange('lightning_address', wallet.lightning_address ?? '');
  onFieldChange('_wallet_id', wallet.id);
}
