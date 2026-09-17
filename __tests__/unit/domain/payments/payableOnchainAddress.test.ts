/**
 * An extended public key is not a payment address — it is the key you derive
 * addresses FROM. Resolution therefore never outputs an xpub as the address:
 * it carries the key (`onchain_xpub`), and `materializeOnchainAddress` derives
 * a fresh, never-reused address at invoice-creation time.
 *
 * The split matters twice over. Handing the raw xpub to a payer produced
 * `bitcoin:xpub6...` — a QR no wallet can pay — while the product reported the
 * seller ready to receive. And deriving at RESOLUTION time would burn a
 * derivation index on every read-only status check, blowing through the
 * recipient wallet's gap limit.
 */

import {
  resolveUserWallet,
  materializeOnchainAddress,
} from '@/domain/payments/walletResolutionService';
import type { ResolvedWallet } from '@/domain/payments/types';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('@/domain/payments/encryptionService', () => ({ decrypt: (v: string) => v }));

const rpcMock = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({ rpc: rpcMock }),
}));

/** Minimal stub of the chained select used by resolveUserWallet. */
function clientReturning(wallets: Array<Record<string, unknown>>): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) {
    builder[m] = vi.fn(() => builder);
  }
  let orderCalls = 0;
  builder.order = vi.fn(() => {
    orderCalls += 1;
    // Second .order() resolves the query.
    return orderCalls >= 2 ? Promise.resolve({ data: wallets, error: null }) : builder;
  });
  return { from: () => builder } as unknown as SupabaseClient;
}

// BIP84 spec-vector zpub; 0/0 = bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu
const ZPUB =
  'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs';
const ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';

beforeEach(() => {
  rpcMock.mockReset();
});

describe('on-chain resolution', () => {
  it('carries an xpub as onchain_xpub, never as the payable address', async () => {
    const resolved = await resolveUserWallet(
      clientReturning([{ id: 'w1', address_or_xpub: ZPUB, wallet_type: 'xpub', is_primary: true }]),
      'user-1'
    );

    expect(resolved).toMatchObject({ method: 'onchain', wallet_id: 'w1', onchain_xpub: ZPUB });
    expect(resolved?.onchain_address).toBeUndefined();
  });

  it('still resolves a plain address directly', async () => {
    const resolved = await resolveUserWallet(
      clientReturning([
        { id: 'w1', address_or_xpub: ADDRESS, wallet_type: 'onchain', is_primary: true },
      ]),
      'user-1'
    );

    expect(resolved).toMatchObject({ method: 'onchain', onchain_address: ADDRESS });
  });

  it('prefers Lightning over any on-chain destination, unchanged', async () => {
    const resolved = await resolveUserWallet(
      clientReturning([
        { id: 'w1', address_or_xpub: ZPUB, wallet_type: 'xpub', is_primary: true },
        { id: 'w2', lightning_address: 'hello@orangecat.ch', wallet_type: 'lightning' },
      ]),
      'user-1'
    );

    expect(resolved).toMatchObject({ method: 'lightning_address' });
  });
});

describe('materializeOnchainAddress', () => {
  it('claims an index atomically and derives the spec-vector address', async () => {
    rpcMock.mockResolvedValue({ data: 0, error: null });

    const wallet: ResolvedWallet = { method: 'onchain', wallet_id: 'w1', onchain_xpub: ZPUB };
    const materialized = await materializeOnchainAddress(wallet);

    expect(rpcMock).toHaveBeenCalledWith('allocate_derivation_index', { p_wallet_id: 'w1' });
    expect(materialized.onchain_address).toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
  });

  it('derives a DIFFERENT address for the next allocated index', async () => {
    rpcMock.mockResolvedValue({ data: 1, error: null });

    const materialized = await materializeOnchainAddress({
      method: 'onchain',
      wallet_id: 'w1',
      onchain_xpub: ZPUB,
    });

    expect(materialized.onchain_address).toBe('bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g');
  });

  it('passes a plain-address wallet through without touching the counter', async () => {
    const wallet: ResolvedWallet = { method: 'onchain', wallet_id: 'w1', onchain_address: ADDRESS };
    expect(await materializeOnchainAddress(wallet)).toBe(wallet);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('leaves Lightning wallets alone', async () => {
    const wallet: ResolvedWallet = { method: 'nwc', wallet_id: 'w1', nwc_uri: 'nostr+wc://x' };
    expect(await materializeOnchainAddress(wallet)).toBe(wallet);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('fails loudly when allocation fails — never falls back to something ambiguous', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'db down' } });

    await expect(
      materializeOnchainAddress({ method: 'onchain', wallet_id: 'w1', onchain_xpub: ZPUB })
    ).rejects.toThrow('Failed to allocate a receiving address');
  });
});
