/**
 * Derivation is checked against the published BIP44/49/84 test vectors (the
 * standard "abandon … about" mnemonic). Deriving a wrong-but-valid address is
 * the worst failure mode in this codebase — money goes somewhere the
 * recipient's wallet never scans — so nothing short of the spec's own numbers
 * counts as proof.
 */

import {
  deriveOnchainAddress,
  deriveChainAddress,
  RECEIVE_CHAIN,
  CHANGE_CHAIN,
  SCANNED_CHAINS,
} from '@/domain/payments/addressDerivation';

const XPUB =
  'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj';
const YPUB =
  'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP';
const ZPUB =
  'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';

describe('deriveOnchainAddress', () => {
  it('derives BIP84 native-segwit addresses from a zpub (spec vectors)', () => {
    expect(deriveOnchainAddress(ZPUB, 0)).toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
    expect(deriveOnchainAddress(ZPUB, 1)).toBe('bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g');
  });

  it('derives BIP49 wrapped-segwit addresses from a ypub (spec vector)', () => {
    expect(deriveOnchainAddress(YPUB, 0)).toBe('37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf');
  });

  it('derives BIP44 legacy addresses from an xpub (spec vector)', () => {
    expect(deriveOnchainAddress(XPUB, 0)).toBe('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
  });

  it('every index yields a distinct address — uniqueness is the whole point', () => {
    const addresses = new Set(Array.from({ length: 25 }, (_, i) => deriveOnchainAddress(ZPUB, i)));
    expect(addresses.size).toBe(25);
  });

  it('rejects testnet keys — a testnet address shown to a mainnet payer loses money', () => {
    const TPUB =
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba';
    expect(() => deriveOnchainAddress(TPUB, 0)).toThrow(/Unsupported extended key prefix/);
  });

  it('rejects garbage and out-of-range indexes', () => {
    expect(() => deriveOnchainAddress('not-a-key', 0)).toThrow();
    expect(() => deriveOnchainAddress(ZPUB, -1)).toThrow(/out of range/);
    expect(() => deriveOnchainAddress(ZPUB, 1.5)).toThrow(/out of range/);
    expect(() => deriveOnchainAddress(ZPUB, 0x80000000)).toThrow(/out of range/);
  });
});

describe('deriveChainAddress', () => {
  it('derives the BIP84 change address from the spec vector', () => {
    // BIP-0084's own test vector for m/84'/0'/0'/1/0 on the "abandon … about"
    // mnemonic. Checked against the spec rather than against this library's
    // output, so the two have to agree for the test to pass.
    expect(deriveChainAddress(ZPUB, CHANGE_CHAIN, 0)).toBe(
      'bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el'
    );
  });

  it('is the same function the receiving path uses, pinned to chain 0', () => {
    for (const index of [0, 1, 7]) {
      expect(deriveChainAddress(ZPUB, RECEIVE_CHAIN, index)).toBe(
        deriveOnchainAddress(ZPUB, index)
      );
    }
  });

  it('never returns a change address where a receiving address was asked for', () => {
    // Handing a payer a change address puts their money where the recipient's
    // wallet does not watch for incoming funds — the one failure worse than
    // showing nothing.
    const receiving = new Set(Array.from({ length: 20 }, (_, i) => deriveOnchainAddress(ZPUB, i)));
    for (let i = 0; i < 20; i += 1) {
      expect(receiving.has(deriveChainAddress(ZPUB, CHANGE_CHAIN, i))).toBe(false);
    }
  });

  it('scans exactly the two BIP44 chains', () => {
    expect([...SCANNED_CHAINS]).toEqual([RECEIVE_CHAIN, CHANGE_CHAIN]);
  });

  it('rejects a chain that is neither receive nor change', () => {
    expect(() => deriveChainAddress(ZPUB, 2 as never, 0)).toThrow(/chain must be 0/);
  });

  it('validates the index on the change chain too', () => {
    expect(() => deriveChainAddress(ZPUB, CHANGE_CHAIN, -1)).toThrow(/out of range/);
    expect(() => deriveChainAddress(ZPUB, CHANGE_CHAIN, 1.5)).toThrow(/out of range/);
  });
});
