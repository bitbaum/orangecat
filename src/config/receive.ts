/**
 * Receive — SSOT for the owner-side "get paid" surface (/receive).
 *
 * Receiving is the mirror of the tips/payment stack, pointed at yourself: a
 * receive request is an entity-less payment_intent against YOUR OWN wallet,
 * minted through the exact same wallet-resolution + invoice + settle path a
 * tipper would use. OrangeCat never touches the funds — the QR pays straight
 * into the owner's wallet.
 *
 * One screen, not a second tab bar. The pay link is the standing way anyone
 * pays. The address code is the in-person version of that same link, and only
 * when it can actually be paid. An exact amount is a code for someone who is
 * here — asking a named account is the Request page.
 */

import { TIP_MIN_BTC, TIP_MAX_BTC, TIP_POLL_INTERVAL_MS } from './tips';

/** Same sane bounds as tips — a receive request is the same economic object. */
export const RECEIVE_MIN_BTC = TIP_MIN_BTC;
export const RECEIVE_MAX_BTC = TIP_MAX_BTC;
export const RECEIVE_POLL_INTERVAL_MS = TIP_POLL_INTERVAL_MS;

export const RECEIVE_SHARE_COPY = {
  heading: 'Your pay link',
  /** Why a link and not only a QR: a QR is useless inside a chat thread. */
  hint: 'Anyone with this link can pay you. They need a Bitcoin wallet, not an OrangeCat account.',
  copy: 'Copy link',
  copied: 'Link copied',
  share: 'Share',
  withAmount: 'Include the amount',
} as const;

export const RECEIVE_COPY = {
  title: 'Receive',
  subtitle: 'Anyone can pay you here. OrangeCat never holds the money.',
  addressLabel: 'In person',
  addressHint: 'Any amount. This code does not expire.',
  exactHeading: 'One amount',
  exactHint:
    'A code for a specific amount, for someone with you. To ask one person by name, use Request.',
  addressCaption: (address: string) => address,
  requestHint: 'Exact amount — you’ll see it the moment it’s paid.',
  amountLabel: 'Amount',
  walletLabel: 'Receive with',
  /** The default choice in the wallet switcher — "whichever wallet is primary". */
  primaryWallet: 'Primary',
  generate: 'Show payment QR',
  generating: 'Creating…',
  scan: 'Waiting for payment…',
  paidTitle: 'Paid!',
  paidBody: 'The payment reached your wallet.',
  expiredTitle: 'Request expired',
  expiredBody: 'No payment was detected before the invoice expired. Create a new one.',
  again: 'New request',
  share: 'Share',
  copied: 'Copied',
  copy: 'Copy',
  onchainNote: 'On-chain payments need block confirmations — not ideal for in-person speed.',
  onchainSeen: 'Payment seen — waiting for confirmation…',
  undetectableNote:
    'This wallet can’t report payments automatically — confirm receipt in your wallet app.',
  noWalletTitle: 'How should people pay you?',
  noWalletBody:
    'Paste whatever your Bitcoin app shows when you tap Receive. If you do not have one yet, get a free one below and paste what it gives you. You can skip this and come back later.',
  notNow: 'Not now',
} as const;
