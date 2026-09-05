/**
 * An extended public key must never reach a non-owner.
 *
 * GET /api/wallets served `address_or_xpub` to anonymous callers through the
 * admin client, and a real 111-char zpub was readable in production. A zpub is
 * not an address — it is the key addresses are derived from, so publishing one
 * hands a visitor every past and future address of that wallet and its whole
 * balance history. That is the privacy per-invoice derivation exists to protect.
 */

import { isExtendedPublicKey, redactExtendedKeys } from '@/lib/wallets/publicWallet';
import { getWalletReceiveHandle } from '@/lib/wallet-receive-handle';

const ZPUB =
  'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';

describe('isExtendedPublicKey', () => {
  it.each(['xpub6abc', 'ypub6abc', 'zpub6abc', 'tpub6abc', 'upub6abc', 'vpub6abc'])('flags %s', v =>
    expect(isExtendedPublicKey(v)).toBe(true)
  );

  it.each([
    'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
    '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
    '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
  ])('leaves the payable address %s alone', v => expect(isExtendedPublicKey(v)).toBe(false));

  it('is safe on empty and missing values', () => {
    expect(isExtendedPublicKey(null)).toBe(false);
    expect(isExtendedPublicKey(undefined)).toBe(false);
    expect(isExtendedPublicKey('   ')).toBe(false);
  });
});

describe('redactExtendedKeys', () => {
  it('nulls a real zpub', () => {
    const [row] = redactExtendedKeys([{ id: 'w1', wallet_type: 'xpub', address_or_xpub: ZPUB }]);
    expect(row.address_or_xpub).toBeNull();
  });

  it('classifies by value, not by the user-set wallet_type label', () => {
    // A key pasted into a row typed 'onchain' is still a key.
    const [row] = redactExtendedKeys([{ id: 'w1', wallet_type: 'onchain', address_or_xpub: ZPUB }]);
    expect(row.address_or_xpub).toBeNull();
  });

  it('keeps a plain address — withholding it would break getting paid', () => {
    const addr = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
    const [row] = redactExtendedKeys([{ id: 'w1', wallet_type: 'onchain', address_or_xpub: addr }]);
    expect(row.address_or_xpub).toBe(addr);
  });

  it('preserves every other field', () => {
    const [row] = redactExtendedKeys([
      { id: 'w1', wallet_type: 'xpub', address_or_xpub: ZPUB, label: 'General', is_primary: true },
    ]);
    expect(row).toMatchObject({ id: 'w1', label: 'General', is_primary: true });
  });

  it('handles an empty list', () => {
    expect(redactExtendedKeys([])).toEqual([]);
  });
});

describe('getWalletReceiveHandle with the key withheld', () => {
  it('stays an on-chain wallet and explains how paying works', () => {
    const handle = getWalletReceiveHandle({ wallet_type: 'xpub', address_or_xpub: null });

    expect(handle.kind).toBe('onchain');
    expect(handle.value).toBeNull();
    expect(handle.qrValue).toBeNull();
    expect(handle.emptyText).toBe('A fresh address is generated when you pay');
  });

  it('does not claim a Bitcoin wallet receives Lightning', () => {
    const handle = getWalletReceiveHandle({ wallet_type: 'xpub', address_or_xpub: null });
    expect(handle.emptyText).not.toMatch(/lightning/i);
  });

  it('still shows a plain address with a payable QR', () => {
    const addr = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
    const handle = getWalletReceiveHandle({ wallet_type: 'onchain', address_or_xpub: addr });

    expect(handle.value).toBe(addr);
    expect(handle.qrValue).toBe(`bitcoin:${addr}`);
  });

  it('still resolves a Lightning wallet', () => {
    const handle = getWalletReceiveHandle({ lightning_address: 'hello@orangecat.ch' });
    expect(handle.kind).toBe('lightning');
    expect(handle.qrValue).toBe('lightning:hello@orangecat.ch');
  });

  it('falls back to the connection state when nothing is public', () => {
    const handle = getWalletReceiveHandle({ wallet_type: 'nwc' });
    expect(handle.kind).toBe('connection');
    expect(handle.value).toBeNull();
  });
});
