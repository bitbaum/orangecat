/**
 * Walking an extended public key the way a wallet does.
 *
 * mempool.space has no xpub endpoint, so reading an xpub wallet means deriving
 * its addresses locally and asking about each one. Two things decide whether
 * the answer is true:
 *
 *   - BOTH chains. A wallet receives on the external chain (0/i) and sends its
 *     own change to the internal chain (1/i). The balance scan and the history
 *     scan each walked chain 0 only — two copies of the same loop, carrying the
 *     same omission — so any wallet that had ever spent reported less than it
 *     held, and every outgoing payment read as its whole input sent, because the
 *     change output was on an address the scan never derived.
 *   - A gap limit PER CHAIN. Wallets stop looking after 20 consecutive unused
 *     addresses on a chain; a receive-chain gap says nothing about the change
 *     chain, so each gets its own count.
 *
 * One scanner, so the balance and the history cannot disagree about which
 * addresses belong to a wallet.
 */

import {
  deriveChainAddress,
  SCANNED_CHAINS,
  type DerivationChain,
} from '@/domain/payments/addressDerivation';

/**
 * Stop scanning a chain after this many consecutive unused addresses (BIP44
 * gap limit). 20 is the wallet-industry default; going lower risks missing
 * funds that a normal wallet would find.
 */
export const GAP_LIMIT = 20;

/** Hard ceiling per chain, so a pathological key cannot issue unbounded requests. */
export const MAX_SCAN_PER_CHAIN = 60;

export interface ScannedAddress<T> {
  address: string;
  chain: DerivationChain;
  index: number;
  /** Whatever the probe measured for this address (a balance, a tx count…). */
  value: T;
}

/**
 * Derive and probe addresses on both chains, returning the used ones.
 *
 * Sequential on purpose: mempool.space rate-limits by IP, and a burst of
 * parallel lookups for one wallet turns an honest scan into a 429. A probe
 * that throws propagates — "we could not look" must never become "unused".
 */
export async function scanUsedAddresses<T>(
  extendedKey: string,
  probe: (address: string) => Promise<{ used: boolean; value: T }>
): Promise<ScannedAddress<T>[]> {
  const used: ScannedAddress<T>[] = [];

  for (const chain of SCANNED_CHAINS) {
    let consecutiveEmpty = 0;
    for (
      let index = 0;
      index < MAX_SCAN_PER_CHAIN && consecutiveEmpty < GAP_LIMIT;
      index += 1
    ) {
      const address = deriveChainAddress(extendedKey, chain, index);
      const result = await probe(address);
      if (result.used) {
        consecutiveEmpty = 0;
        used.push({ address, chain, index, value: result.value });
      } else {
        consecutiveEmpty += 1;
      }
    }
  }

  return used;
}
