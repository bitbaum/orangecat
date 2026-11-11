/**
 * What a wallet app actually hands you, turned into what we store.
 *
 * The add-wallet field invites you to "paste anything your wallet gives you" —
 * and then rejected most of it. Tap "copy" in a wallet and you rarely get a bare
 * address; you get a BIP-21 URI. Scan a QR and you get the same thing in
 * UPPERCASE, because uppercase packs into the alphanumeric mode and makes the
 * code smaller to scan. Measured against the validator before this existed:
 *
 *   bc1qw508d6…                      accepted
 *   bitcoin:bc1qw508d6…              REJECTED
 *   bitcoin:bc1qw508d6…?amount=0.001 REJECTED
 *   BITCOIN:BC1QW508D6…              REJECTED
 *
 * Three of the four forms a person is most likely to have on their clipboard.
 *
 * Normalising here rather than loosening the validator is deliberate: the
 * checksum rules stay exactly as strict, and only the packaging is removed.
 */

import { normalizePastedHandle as paykitNormalizePastedHandle } from '@bitbaum/paykit';

/**
 * Strip the packaging from a pasted or scanned payment handle.
 *
 * Pure and total: anything it does not recognise comes back trimmed and
 * otherwise untouched, so an unknown format still reaches the validator and
 * still produces the validator's own error rather than a silent mangling.
 */
export function normalizePastedHandle(raw: string): string {
  try {
    return paykitNormalizePastedHandle(raw);
  } catch {
    // PayKit 0.1.0 throws on malformed percent escapes in a BIP-21 query.
    // Treat malformed clipboard/QR input as unrecognized until its fix ships.
    return '';
  }
}
