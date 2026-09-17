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

/** Schemes a wallet may wrap a handle in. `nostr+walletconnect` is NOT here — it is the handle. */
const SCHEME = /^(bitcoin|lightning|lnurlp|lnurl):(\/\/)?/i;

/** A bech32/bech32m address in one case or the other. Mixed case is invalid by spec, so leave it be. */
const ALL_UPPER_BECH32 = /^(BC1|TB1|BCRT1)[0-9A-Z]+$/;

/**
 * Strip the packaging from a pasted or scanned payment handle.
 *
 * Pure and total: anything it does not recognise comes back trimmed and
 * otherwise untouched, so an unknown format still reaches the validator and
 * still produces the validator's own error rather than a silent mangling.
 */
export function normalizePastedHandle(raw: string): string {
  const input = (raw ?? '').trim();
  if (!input) {
    return '';
  }

  // A wallet connection URI is the credential itself — scheme and all.
  if (input.toLowerCase().startsWith('nostr+walletconnect://')) {
    return input;
  }

  const scheme = input.match(SCHEME);
  let body = scheme ? input.slice(scheme[0].length) : input;

  if (scheme) {
    // BIP-21 parameters. `bitcoin:?lightning=lnbc…` is a unified QR with no
    // on-chain address: fall back to the lightning payload so the paste is not
    // simply empty, and let the validator judge it.
    const q = body.indexOf('?');
    if (q !== -1) {
      const params = new URLSearchParams(body.slice(q + 1));
      const address = body.slice(0, q).trim();
      body = address || (params.get('lightning') ?? '').trim();
    }
  }

  body = body.trim();

  // Bech32 is case-insensitive but must be uniformly cased; a QR gives upper.
  // Base58 (legacy addresses, xpub/ypub/zpub) is case-SENSITIVE — never touch it.
  if (ALL_UPPER_BECH32.test(body)) {
    return body.toLowerCase();
  }

  return body;
}
