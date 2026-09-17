/**
 * "Paste anything your wallet gives you" — measured against what wallets
 * actually give you.
 *
 * Before this normaliser, three of the four most likely clipboard contents were
 * rejected by the add-wallet field:
 *
 *   bc1qw508d6…                       accepted
 *   bitcoin:bc1qw508d6…               REJECTED
 *   bitcoin:bc1qw508d6…?amount=0.001  REJECTED
 *   BITCOIN:BC1QW508D6…               REJECTED
 *
 * Tap "copy" in most wallets and you get a BIP-21 URI, not a bare address. Scan
 * a QR and you get the same thing in UPPERCASE, because uppercase packs into
 * the alphanumeric mode and keeps the code small enough to scan quickly.
 *
 * The validator's strictness is unchanged — only the packaging is removed.
 */

import { describe, it, expect } from 'vitest';
import { normalizePastedHandle } from '@/lib/wallets/pastedHandle';
import { validateAddressOrXpub, classifyWalletInput } from '@/types/wallet';

const ADDR = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const LEGACY = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2';
const ZPUB =
  'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';
const NWC = 'nostr+walletconnect://abc123?relay=wss://relay.example&secret=deadbeef';

describe('normalizePastedHandle', () => {
  it('leaves a bare address alone', () => {
    expect(normalizePastedHandle(ADDR)).toBe(ADDR);
  });

  it('strips a bitcoin: scheme', () => {
    expect(normalizePastedHandle(`bitcoin:${ADDR}`)).toBe(ADDR);
  });

  it('drops BIP-21 parameters', () => {
    expect(normalizePastedHandle(`bitcoin:${ADDR}?amount=0.001&label=Rent`)).toBe(ADDR);
  });

  it('lowercases the uppercase form a QR code encodes', () => {
    expect(normalizePastedHandle(`BITCOIN:${ADDR.toUpperCase()}`)).toBe(ADDR);
  });

  it('never touches the case of a base58 address', () => {
    // Bech32 is case-insensitive; base58 is NOT. Lowercasing a legacy address
    // would change which key it refers to and send money nowhere.
    expect(normalizePastedHandle(LEGACY)).toBe(LEGACY);
    expect(normalizePastedHandle(`bitcoin:${LEGACY}`)).toBe(LEGACY);
  });

  it('never touches an extended key', () => {
    expect(normalizePastedHandle(ZPUB)).toBe(ZPUB);
  });

  it('keeps a wallet connection URI whole — the scheme IS the credential', () => {
    expect(normalizePastedHandle(NWC)).toBe(NWC);
  });

  it('strips lightning: from a Lightning address', () => {
    expect(normalizePastedHandle('lightning:alice@wallet.com')).toBe('alice@wallet.com');
  });

  it('falls back to the lightning payload of a unified QR with no address', () => {
    expect(normalizePastedHandle('bitcoin:?lightning=lnbc1exampleinvoice')).toBe(
      'lnbc1exampleinvoice'
    );
  });

  it('hands anything unrecognised straight through, trimmed', () => {
    // An unknown format must still reach the validator and produce the
    // validator's own error, rather than being silently mangled into something
    // that looks valid.
    expect(normalizePastedHandle('  not-an-address  ')).toBe('not-an-address');
    expect(normalizePastedHandle('')).toBe('');
  });
});

describe('the four forms a person actually has on their clipboard', () => {
  const CASES = [
    ['bare address', ADDR],
    ['bitcoin: URI', `bitcoin:${ADDR}`],
    ['bitcoin: URI with an amount', `bitcoin:${ADDR}?amount=0.001`],
    ['uppercase QR payload', `BITCOIN:${ADDR.toUpperCase()}`],
  ] as const;

  for (const [name, value] of CASES) {
    it(`accepts a ${name}`, () => {
      expect(validateAddressOrXpub(normalizePastedHandle(value)).valid).toBe(true);
    });

    it(`routes a ${name} to the on-chain field`, () => {
      // The classifier decides which field a paste lands in. If it sees the raw
      // URI it returns 'unknown', the form clears every field, and submitting
      // says "we couldn't recognize that" about a perfectly good address.
      expect(classifyWalletInput(value)).toBe('onchain');
    });
  }

  it('still routes an extended key and a connection URI correctly', () => {
    expect(classifyWalletInput(ZPUB)).toBe('xpub');
    expect(classifyWalletInput(NWC)).toBe('nwc');
    expect(classifyWalletInput('alice@wallet.com')).toBe('lightning');
  });
});
