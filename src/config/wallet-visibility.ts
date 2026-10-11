/**
 * SSOT for funding transparency levels on a wallet-entity link.
 *
 * Mirrors the CHECK constraint on entity_wallets.visibility
 * (see migration 20260706000000_entity_wallet_visibility.sql). Drives the
 * owner toggle UI, validation, and any label rendering — one place, so the
 * three levels never drift between DB, API, and UI.
 */

export const WALLET_VISIBILITY_LEVELS = ['private', 'total', 'public'] as const;

export type WalletVisibility = (typeof WALLET_VISIBILITY_LEVELS)[number];

export const WALLET_VISIBILITY_DEFAULT: WalletVisibility = 'private';

export interface WalletVisibilityOption {
  value: WalletVisibility;
  label: string;
  description: string;
}

/** Ordered private → public, for a progressive-disclosure control. */
export const WALLET_VISIBILITY_OPTIONS: readonly WalletVisibilityOption[] = [
  {
    value: 'private',
    label: 'Hide total and supporters',
    // Not "Private": the receiving address is shown to every payer (it has to
    // be, to be paid), and on-chain payments are public on the blockchain.
    // What this setting hides is OrangeCat's own running total and list.
    description:
      'OrangeCat won’t show your running total or who gave. Payers still see your receiving address, and on-chain payments are always public on the blockchain.',
  },
  {
    value: 'total',
    label: 'Show total',
    description: 'Anyone sees the running total and goal progress — but not who gave.',
  },
  {
    value: 'public',
    label: 'Fully public',
    description: 'Anyone also sees the supporter list and the receiving address.',
  },
] as const;
