/**
 * Receive — SSOT for the owner-side "get paid" surface (/receive).
 *
 * One question on screen: the pay link, with Copy (and Share) right under it.
 * "Where this goes" opens the Lightning name and the wallet the coins settle
 * in. This page does not mint an invoice and does not ask which wallet — the
 * payer types the amount on the link. Asking a named account is Request.
 *
 * OrangeCat never holds the funds. The link and the Lightning name are the
 * same door; the coins land in the wallet the owner connected.
 */

import { TIP_MIN_BTC, TIP_MAX_BTC, TIP_POLL_INTERVAL_MS } from './tips';
import { WALLET_PROVIDERS } from './wallet-providers';

/** Same sane bounds as tips — a receive request is the same economic object. */
export const RECEIVE_MIN_BTC = TIP_MIN_BTC;
export const RECEIVE_MAX_BTC = TIP_MAX_BTC;
export const RECEIVE_POLL_INTERVAL_MS = TIP_POLL_INTERVAL_MS;

/**
 * Where the owner opens the wallet that actually holds the coins.
 * The host of the Lightning address must be a provider we already list.
 * Anything else stays plain text, so a saved address cannot become a link.
 */
export function walletAppUrl(destination: string): string | null {
  const at = destination.lastIndexOf('@');
  if (at < 1) {
    return null;
  }
  const host = destination.slice(at + 1).toLowerCase();
  for (const provider of Object.values(WALLET_PROVIDERS)) {
    let site: URL;
    try {
      site = new URL(provider.website);
    } catch {
      continue;
    }
    if (site.hostname === host || site.hostname === `www.${host}`) {
      return provider.website;
    }
  }
  return null;
}

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
  subtitle: 'Anyone with a Bitcoin wallet can pay you.',
  addressLabel: 'Your name',
  addressHint:
    'The same door, for a wallet app. A rename changes the name we show. The old name still pays.',
  arrivesAt: (destination: string) =>
    `The money arrives at ${destination}. Open that wallet to see the balance.`,
  arrivesInApp:
    'Payments arrive in the wallet app you connected. OrangeCat cannot open that app or show its balance.',
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
