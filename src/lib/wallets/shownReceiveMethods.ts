/**
 * How many ways-to-receive the profile Wallets tab actually shows — the badge
 * and the tab both read this, so the number on the tab is what is under it.
 *
 * The rule: wallet rows win. The legacy single `bitcoin_address` /
 * `lightning_address` on the profile are only rendered (as one donation card)
 * when the profile has no wallet rows at all. The badge used to add the legacy
 * fields on top of the rows, so a profile with two wallets and a legacy
 * Lightning address read "Wallets 3" over two cards.
 */
export function showsLegacyReceive(walletRowCount: number): boolean {
  return walletRowCount === 0;
}

export function countShownReceiveMethods(
  walletRowCount: number,
  legacy: { bitcoin_address?: string | null; lightning_address?: string | null }
): number {
  if (!showsLegacyReceive(walletRowCount)) {
    return walletRowCount;
  }
  return (legacy.bitcoin_address ? 1 : 0) + (legacy.lightning_address ? 1 : 0);
}
