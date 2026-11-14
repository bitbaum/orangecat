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
import { PAY_STATE_WORDS } from './pay-words';

/** Quick-pick amounts (BTC). Reuses the contribution presets for consistency. */
export const TIP_QUICK_AMOUNTS_BTC = CONTRIBUTION_QUICK_AMOUNTS_BTC;

export const DEFAULT_TIP_BTC = DEFAULT_CONTRIBUTION_BTC;

/** Sane bounds — a positive amount, capped to avoid fat-finger disasters. */
export const TIP_MIN_BTC = 0.000001;
export const TIP_MAX_BTC = 1;

export const TIP_COPY = {
  // One pay machine, one set of state words: src/config/pay-words.ts.
  ...PAY_STATE_WORDS,
  // "Support", the word the profile and every page use for this act. "Tip"
  // reads as optional small change (.claude/rules/domain-specific.md).
  button: 'Support',
  title: (name: string) => `Support ${name}`,
  subtitle: 'Bitcoin, straight to their wallet.',
  /** The one action: the verb and the figure, as on /pay. */
  payAmount: (amount: string) => `Support ${amount}`,
  noWallet: (name: string) =>
    `${name} hasn't added a Bitcoin wallet yet, so there is nowhere to pay.`,
  done: 'Done',
} as const;

/** How often the dialog polls for tip settlement, in milliseconds. */
export const TIP_POLL_INTERVAL_MS = 3000;
