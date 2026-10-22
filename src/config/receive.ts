/**
 * Receive — SSOT for the owner-side "get paid" surface (/receive).
 *
 * One thing on screen: the code that pays you, with Copy and Share right
 * under it, then every way you are paid. This page does not mint an invoice,
 * does not ask which wallet and does not ask for an amount — the payer types
 * what they owe on the page the code opens. Asking someone for a figure is
 * Request.
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
  copy: 'Copy link',
  copied: 'Link copied',
  share: 'Share',
  /** The one QR on the screen: the pay link, so any camera opens it. */
  qrTitle: (name: string) => `QR code to pay ${name}`,
} as const;

export const RECEIVE_COPY = {
  title: 'Receive',
  subtitle: 'Anyone can pay you, in any currency you accept.',
  addressHint:
    'The same door, for a wallet app. A rename changes the name we show. The old name still pays.',
  arrivesAt: (destination: string) =>
    `The money arrives at ${destination}. Open that wallet to see the balance.`,
  arrivesInApp:
    'Payments arrive in the wallet app you connected. OrangeCat cannot open that app or show its balance.',
  onchainNote: 'On-chain payments need block confirmations — not ideal for in-person speed.',
  noWalletTitle: 'How should people pay you?',
  noWalletBody:
    'Paste whatever your Bitcoin app shows when you tap Receive. If you do not have one yet, get a free one below and paste what it gives you. You can skip this and come back later.',
  notNow: 'Not now',
  /** The Bitcoin row's right-hand action. */
  manageBitcoin: 'Change',
  setUpBitcoin: 'Set up',
} as const;
