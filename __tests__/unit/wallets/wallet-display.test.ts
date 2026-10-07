/**
 * "Pay into" cards (2026-10-07): two rows for one Coinos account read as two
 * wallets, and a Lightning-only wallet was warned about on-chain linkability.
 */
import { describe, expect, it } from 'vitest';
import {
  reuseIsPublicOnChain,
  sameDestinationAs,
  walletRail,
} from '@/components/create/wallet-selector/wallet-display';
import type { Wallet } from '@/types/wallet';

const w = (over: Partial<Wallet>): Wallet =>
  ({
    id: over.id ?? 'w',
    label: over.label ?? 'Main',
    address_or_xpub: null,
    lightning_address: null,
    category: 'general',
    ...over,
  }) as Wallet;

describe('wallet display', () => {
  it('names the rail and where money lands', () => {
    expect(walletRail(w({ lightning_address: 'orangecat@coinos.io' }))).toEqual({
      rail: 'lightning',
      destination: 'orangecat@coinos.io',
    });
    expect(
      walletRail(w({ address_or_xpub: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' })).rail
    ).toBe('onchain');
  });

  it('tells two rows for one account apart as the same place', () => {
    const a = w({
      id: 'a',
      label: 'Coinos platform (fallback)',
      lightning_address: 'orangecat@coinos.io',
    });
    const b = w({
      id: 'b',
      label: 'Coinos (NWC send + LN receive)',
      lightning_address: 'OrangeCat@coinos.io ',
    });
    const c = w({ id: 'c', label: 'Other', lightning_address: 'me@getalby.com' });
    const same = sameDestinationAs([a, b, c]);
    expect(same.get('a')).toEqual(['Coinos (NWC send + LN receive)']);
    expect(same.get('b')).toEqual(['Coinos platform (fallback)']);
    expect(same.has('c')).toBe(false);
  });

  it('a wallet with both rails is paid over Lightning, and says so', () => {
    const both = w({
      lightning_address: 'me@coinos.io',
      address_or_xpub: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    });
    expect(walletRail(both).rail).toBe('lightning');
    expect(reuseIsPublicOnChain(both)).toBe(false);
  });

  it('only a plain on-chain address makes reuse public on the blockchain', () => {
    expect(reuseIsPublicOnChain(w({ lightning_address: 'orangecat@coinos.io' }))).toBe(false);
    expect(
      reuseIsPublicOnChain(w({ address_or_xpub: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' }))
    ).toBe(true);
    expect(reuseIsPublicOnChain(undefined)).toBe(false);
  });
});
