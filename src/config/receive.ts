/**
 * Receive — SSOT for the owner-side "get paid" surface (/receive).
 *
 * Receiving is the mirror of the tips/payment stack, pointed at yourself: a
 * receive request is an entity-less payment_intent against YOUR OWN wallet,
 * minted through the exact same wallet-resolution + invoice + settle path a
 * tipper would use. OrangeCat never touches the funds — the QR pays straight
 * into the owner's wallet.
 *
 * Two modes:
 *  - "My address": a static QR of <username>@orangecat.ch. Never expires,
 *    works with any Lightning wallet, payer picks the amount. It is an ALIAS —
 *    only alive while a real receiving wallet is configured behind it.
 *  - "Request amount": an exact-amount invoice (or fresh on-chain address)
 *    with live settlement feedback, so the payer can't fat-finger the amount.
 */

import { TIP_MIN_BTC, TIP_MAX_BTC, TIP_POLL_INTERVAL_MS } from './tips';

/** Same sane bounds as tips — a receive request is the same economic object. */
export const RECEIVE_MIN_BTC = TIP_MIN_BTC;
export const RECEIVE_MAX_BTC = TIP_MAX_BTC;
export const RECEIVE_POLL_INTERVAL_MS = TIP_POLL_INTERVAL_MS;

export const RECEIVE_SHARE_COPY = {
  heading: 'Send someone a payment link',
  /** Why a link and not the QR: a QR is useless inside a chat thread. */
  hint: 'Works in WhatsApp, email, anywhere. They can pay from any Bitcoin wallet — no OrangeCat account needed.',
  copy: 'Copy link',
  copied: 'Link copied',
  share: 'Share',
  withAmount: 'Include the amount',
} as const;

export const RECEIVE_COPY = {
  title: 'Receive',
  subtitle: 'Get paid straight to your wallet — OrangeCat never holds your money.',
  addressTab: 'My address',
  requestTab: 'Request amount',
  addressHint: 'Any amount, any Lightning wallet. This QR never expires.',
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
