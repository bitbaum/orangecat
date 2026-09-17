/**
 * resolveSpecificUserWallet — the /receive wallet switcher's resolver.
 *
 * The owner picked a wallet explicitly, so no cross-wallet priority applies —
 * but ownership is non-negotiable: a wallet id belonging to someone else (or
 * inactive) must resolve to null, never to a payable rail.
 */

import { resolveSpecificUserWallet } from '@/domain/payments/walletResolutionService';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/domain/payments/encryptionService', () => ({
  decrypt: vi.fn((v: string) => `decrypted:${v}`),
  canDecrypt: vi.fn(() => true),
}));

const USER = 'user-1';
const WALLET = 'wallet-1';

/** Client whose maybeSingle returns the given row; records applied filters. */
function makeSupabase(row: Record<string, unknown> | null) {
  const filters: Array<[string, unknown]> = [];
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((col: string, val: unknown) => {
    filters.push([col, val]);
    return builder;
  });
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: row, error: null }));
  return {
    client: { from: vi.fn(() => builder) } as unknown as SupabaseClient,
    filters,
  };
}

describe('resolveSpecificUserWallet', () => {
  it('scopes the query to owner + active — ownership is part of the query', async () => {
    const { client, filters } = makeSupabase(null);
    const res = await resolveSpecificUserWallet(client, USER, WALLET);
    expect(res).toBeNull();
    expect(filters).toEqual(
      expect.arrayContaining([
        ['id', WALLET],
        ['profile_id', USER],
        ['is_active', true],
      ])
    );
  });

  it('resolves NWC first within the wallet', async () => {
    const { client } = makeSupabase({
      id: WALLET,
      nwc_connection_uri: 'enc',
      lightning_address: 'a@b.c',
      address_or_xpub: null,
    });
    const res = await resolveSpecificUserWallet(client, USER, WALLET);
    // NWC still wins — and now carries the wallet's lightning address as a
    // RECEIVE fallback, because a send-only connection cannot mint invoices
    // and must not take receiving down with it. See ResolvedWallet.
    expect(res).toEqual({
      method: 'nwc',
      wallet_id: WALLET,
      nwc_uri: 'decrypted:enc',
      lightning_address: 'a@b.c',
    });
  });

  it('falls back to the Lightning address, then on-chain', async () => {
    const { client } = makeSupabase({
      id: WALLET,
      nwc_connection_uri: null,
      lightning_address: 'a@b.c',
      address_or_xpub: null,
    });
    const res = await resolveSpecificUserWallet(client, USER, WALLET);
    expect(res).toEqual({
      method: 'lightning_address',
      wallet_id: WALLET,
      lightning_address: 'a@b.c',
    });
  });

  it('returns null for a wallet with no usable payment detail', async () => {
    const { client } = makeSupabase({
      id: WALLET,
      nwc_connection_uri: null,
      lightning_address: null,
      address_or_xpub: '',
    });
    expect(await resolveSpecificUserWallet(client, USER, WALLET)).toBeNull();
  });
});
