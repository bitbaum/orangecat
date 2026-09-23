/**
 * Point an entity form at a saved wallet row.
 *
 * Payment resolution reads `entity_wallets` via `_wallet_id`. The address
 * columns are still copied so pages that display them stay in sync. Writing
 * only the columns leaves the pay link unable to receive.
 */

export interface SelectableWallet {
  id: string;
  address_or_xpub: string | null;
  lightning_address: string | null;
}

export function applyWalletSelection(
  onFieldChange: (field: string, value: unknown) => void,
  wallet: SelectableWallet
): void {
  onFieldChange('bitcoin_address', wallet.address_or_xpub ?? '');
  onFieldChange('lightning_address', wallet.lightning_address ?? '');
  onFieldChange('_wallet_id', wallet.id);
}
