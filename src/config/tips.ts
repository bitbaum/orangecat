/**
 * Tips — SSOT for the Bitcoin tipping surface.
 *
 * A tip is an UNCONDITIONAL Bitcoin gift from one person to another. It settles
 * NON-CUSTODIALLY: OrangeCat generates a payment request against the recipient's
 * OWN wallet (NWC / Lightning address / on-chain) and never touches the funds.
 * Zero platform fee — the tipper pays exactly the amount they choose.
 *
 * A tip is minted as an entity-less payment_intent (intent_kind='tip'), so it
 * rides the shared settle path: the tipper sees live confirmation and the
 * recipient gets the standard "you got paid" notification. Keep the copy honest:
 * we help you pay the writer directly, we don't hold or take a cut.
 */

import { CONTRIBUTION_QUICK_AMOUNTS_BTC, DEFAULT_CONTRIBUTION_BTC } from './payment-presets';

/** Quick-pick amounts (BTC). Reuses the contribution presets for consistency. */
export const TIP_QUICK_AMOUNTS_BTC = CONTRIBUTION_QUICK_AMOUNTS_BTC;

export const DEFAULT_TIP_BTC = DEFAULT_CONTRIBUTION_BTC;

/** Sane bounds — a positive amount, capped to avoid fat-finger disasters. */
export const TIP_MIN_BTC = 0.000001;
export const TIP_MAX_BTC = 1;

export const TIP_COPY = {
  button: 'Tip',
  title: (name: string) => `Tip ${name}`,
  subtitle: 'Send a Bitcoin gift, paid straight to their wallet.',
  amountLabel: 'Amount',
  custom: 'Custom',
  generate: 'Show tip QR',
  generating: 'Preparing…',
  scan: 'Waiting for the tip…',
  noWallet: (name: string) => `${name} hasn't set up a wallet to receive Bitcoin tips yet.`,
  /** The honesty line — non-custodial, zero fee. */
  disclaimer: 'Paid directly to them. OrangeCat takes 0% and never touches your funds.',
  again: 'Change amount',
  done: 'Done',
  /** Live confirmation once the tip settles on-rail. */
  paidTitle: 'Tip received!',
  paidBody: (name: string) => `Paid straight to ${name}'s wallet. Zero fee, zero middleman.`,
  expiredTitle: 'This tip request expired',
  expiredBody: 'No Bitcoin was sent. You can start a new tip anytime.',
  payFromWallet: 'Tip from my wallet',
  payFromWalletNote: "They'll see it was you.",
  payingFromWallet: 'Sending from your wallet…',
  confirming: 'Sent. Confirming…',
  walletDeclined: (reason: string) =>
    `Your wallet couldn't send this: ${reason} You can pay the code below from another wallet.`,
} as const;

/** How often the dialog polls for tip settlement, in milliseconds. */
export const TIP_POLL_INTERVAL_MS = 3000;
