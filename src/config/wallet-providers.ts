/**
 * Wallet providers — SSOT for provider IDENTITY.
 *
 * Four places in this repo told a user which Bitcoin wallet to get, each with
 * its own copy of the names, URLs and platform lists:
 *   - the public guide (`/bitcoin-wallet-guide`) recommended Primal
 *   - the wallets page (`/wallets`) recommended BlueWallet and Phoenix
 *   - the wallet form's "don't have a wallet?" panel offered Primal and Coinos
 *   - the Nostr connection card linked Alby
 * They had already drifted, and none of them was reachable by the Cat — which
 * is the interface that actually meets a user with no wallet. The last two were
 * found by the gate in wallet-providers-ssot.test.ts, not by reading the code.
 *
 * So identity lives here once. Each surface keeps its own EDITORIAL (pros, cons,
 * difficulty, which subset it shows) and refers to providers by id. Changing a
 * URL is a one-line change; adding a provider cannot half-land.
 *
 * Only claims already made in this repo are encoded here. `lightningAddress` is
 * deliberately conservative: it means "this provider hands you a name@domain
 * address", which is the ONE capability OrangeCat needs to receive — not merely
 * "supports Lightning". A provider we are not sure about is marked false, so the
 * Cat under-promises rather than sending someone on a dead-end setup.
 */

export type WalletFormFactor = 'mobile' | 'desktop' | 'browser' | 'hardware';

/** Who holds the keys the moment you finish setup. */
export type WalletCustody = 'self' | 'custodial';

export interface WalletProvider {
  id: string;
  name: string;
  website: string;
  /** Where the user installs it — drives the "on your phone / on your laptop" phrasing. */
  formFactor: WalletFormFactor;
  /** Operating systems, as the provider ships them. */
  platforms: string[];
  custody: WalletCustody;
  /** Can send/receive over the Lightning Network at all. */
  lightning: boolean;
  /**
   * Hands the user a `name@domain` Lightning address. This is the field
   * OrangeCat stores and the thing that makes a profile payable — a wallet that
   * "supports Lightning" but never gives an address does not solve the problem.
   */
  lightningAddress: boolean;
  /** Realistic minutes from install to holding a Lightning address. */
  minutesToLightningAddress?: number;
  /** One sentence, written for someone who has never owned Bitcoin. */
  oneLiner: string;
}

export const WALLET_PROVIDERS: Record<string, WalletProvider> = {
  primal: {
    id: 'primal',
    name: 'Primal',
    website: 'https://primal.net/downloads',
    formFactor: 'mobile',
    platforms: ['iOS', 'Android'],
    custody: 'custodial',
    lightning: true,
    lightningAddress: true,
    minutesToLightningAddress: 1,
    oneLiner: 'Install it and you have a Lightning address in about a minute.',
  },
  coinos: {
    id: 'coinos',
    name: 'Coinos',
    website: 'https://coinos.io',
    formFactor: 'browser',
    platforms: ['Web', 'iOS', 'Android'],
    custody: 'custodial',
    lightning: true,
    lightningAddress: true,
    minutesToLightningAddress: 1,
    oneLiner: 'Free, works in a browser, gives you a Lightning address immediately.',
  },
  // Alby is NOT a one-minute custodial address any more, and recommending it
  // as one sent people to a dead end. Verified against a real free Alby
  // account, 2026-09-07: the dashboard says "Run your own Alby Hub to start
  // sending and receiving", its lightning address answers
  //   {"status":"ERROR","reason":"The recipient's wallet is not properly
  //    configured. Please reach out to the recipient to resolve this issue."}
  // and the address cannot even be renamed without a paid plan. Alby migrated
  // to self-custodial Alby Hub, so "install it and you have an address" is now
  // "run a Lightning node, fund it, manage channels".
  //
  // Kept in the list because Alby Hub is genuinely good once it exists — and
  // because deleting the entry would just let someone re-add the old claim.
  // The honest framing keeps it out of the beginner path.
  alby: {
    id: 'alby',
    name: 'Alby Hub',
    website: 'https://albyhub.com',
    formFactor: 'browser',
    platforms: ['Web', 'Chrome', 'Firefox'],
    custody: 'self',
    lightning: true,
    // No address until a Hub is running and funded. Deliberately no
    // minutesToLightningAddress: there is no honest number to put here.
    lightningAddress: false,
    oneLiner:
      'Self-custodial: you run Alby Hub and fund a channel first. Powerful, and it speaks NWC — but not a first wallet.',
  },
  bluewallet: {
    id: 'bluewallet',
    name: 'BlueWallet',
    website: 'https://bluewallet.io',
    formFactor: 'mobile',
    platforms: ['iOS', 'Android'],
    custody: 'self',
    lightning: true,
    lightningAddress: false,
    oneLiner: 'Bitcoin-only mobile wallet with both on-chain and Lightning support.',
  },
  phoenix: {
    id: 'phoenix',
    name: 'Phoenix Wallet',
    website: 'https://phoenix.acinq.co',
    formFactor: 'mobile',
    platforms: ['iOS', 'Android'],
    custody: 'self',
    lightning: true,
    lightningAddress: false,
    oneLiner: 'Self-custodial Lightning wallet that manages channels for you.',
  },
  breez: {
    id: 'breez',
    name: 'Breez',
    website: 'https://breez.technology',
    formFactor: 'mobile',
    platforms: ['iOS', 'Android'],
    custody: 'self',
    lightning: true,
    lightningAddress: false,
    oneLiner: 'Non-custodial Lightning wallet with creator tools and instant payments.',
  },
  brave: {
    id: 'brave',
    name: 'Brave Wallet',
    website: 'https://brave.com/',
    formFactor: 'browser',
    platforms: ['Windows', 'macOS', 'Linux', 'iOS', 'Android'],
    custody: 'self',
    lightning: false,
    lightningAddress: false,
    oneLiner: 'Built into the Brave browser. On-chain only — it cannot receive Lightning.',
  },
  exodus: {
    id: 'exodus',
    name: 'Exodus',
    website: 'https://www.exodus.com/',
    formFactor: 'desktop',
    platforms: ['Windows', 'macOS', 'Linux', 'iOS', 'Android'],
    custody: 'self',
    lightning: false,
    lightningAddress: false,
    oneLiner: 'Friendly multi-currency desktop wallet with portfolio tracking.',
  },
  electrum: {
    id: 'electrum',
    name: 'Electrum',
    website: 'https://electrum.org/',
    formFactor: 'desktop',
    platforms: ['Windows', 'macOS', 'Linux', 'Android'],
    custody: 'self',
    lightning: false,
    lightningAddress: false,
    oneLiner: 'Lightweight, fast, Bitcoin-only desktop wallet for power users.',
  },
  sparrow: {
    id: 'sparrow',
    name: 'Sparrow Wallet',
    website: 'https://sparrowwallet.com',
    formFactor: 'desktop',
    platforms: ['Windows', 'macOS', 'Linux'],
    custody: 'self',
    lightning: false,
    lightningAddress: false,
    oneLiner: 'Privacy-focused desktop wallet with full control over coins.',
  },
};

/**
 * The answer to "I don't have a Bitcoin wallet — what do I do?", ordered by how
 * fast the user ends up payable. Everything here hands out a Lightning address;
 * nothing else does, so nothing else belongs in that answer.
 */
export const LIGHTNING_ADDRESS_PROVIDERS: WalletProvider[] = Object.values(WALLET_PROVIDERS)
  .filter(p => p.lightningAddress)
  .sort((a, b) => (a.minutesToLightningAddress ?? 99) - (b.minutesToLightningAddress ?? 99));

/** Compact one-line-per-provider rendering, for prompts and plain-text surfaces. */
export function renderLightningAddressProviders(): string {
  return LIGHTNING_ADDRESS_PROVIDERS.map(
    p =>
      `- **${p.name}** (${p.website}) — ${p.oneLiner}` +
      (p.custody === 'custodial' ? ' Starts custodial; they can move to self-custody later.' : '')
  ).join('\n');
}
