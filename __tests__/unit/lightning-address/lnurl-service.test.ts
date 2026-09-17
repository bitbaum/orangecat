/**
 * lnurl-service — username→recipient resolution, Lightning-only wallet gating,
 * and metadata shape. Mocks the admin client (profiles lookup) and the reused
 * wallet resolver so we test the LNURL layer in isolation.
 */

import {
  resolveLnurlRecipient,
  resolveLnurlWallet,
  buildLnurlMetadata,
} from '@/domain/lightning-address/lnurl-service';
import { resolveUserWallet } from '@/domain/payments/walletResolutionService';
import { getAdminClient } from '@/lib/supabase/admin';

import type { MockedFunction } from 'vitest';

vi.mock('@/domain/payments/walletResolutionService', () => ({
  resolveUserWallet: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn(),
}));

const mockResolveWallet = resolveUserWallet as MockedFunction<typeof resolveUserWallet>;
const mockGetAdmin = getAdminClient as MockedFunction<typeof getAdminClient>;

/**
 * Table-aware admin stub.
 *
 * `profiles` is now looked up with `.eq('username_lower', ...)`, not `.ilike`.
 * That is the point of the change these tests cover: ilike treats `_` as a
 * single-character wildcard and `_` is legal in a username, so with every new
 * handle shaped `user_<hex>` an ilike lookup for `user_823e4d9d2714` also
 * matches `userX823e4d9d2714` — on the lookup that decides where a payment
 * settles.
 *
 * `byId` serves the second profiles read, after a hit in username history.
 */
function adminReturning(
  profile: Record<string, unknown> | null,
  opts: { history?: { profile_id: string } | null; byId?: Record<string, unknown> | null } = {}
) {
  const calls: Array<{ table: string; column: string; value: unknown }> = [];
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];
  const stub = {
    calls,
    rpcCalls,
    // History goes through an RPC, not a filter: PostgREST reads `+` in a query
    // string as a space, so `.eq('old_username', 'butaeff+ocauth2')` searched
    // for "butaeff ocauth2". An RPC argument travels in a JSON body.
    rpc: async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return { data: opts.history?.profile_id ?? null, error: null };
    },
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: unknown) => {
          calls.push({ table, column, value });
          const data = column === 'id' ? (opts.byId ?? null) : profile;
          return { maybeSingle: async () => ({ data, error: null }) };
        },
      }),
    }),
  };
  return stub;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('a handle the profile no longer uses', () => {
  // 75 accounts published their email local part as a public handle and are
  // being renamed. A username here is a Lightning address, and a saved
  // Lightning address has no expiry — so if a rename made the old one stop
  // resolving, somebody's next payment would fail with "no such recipient"
  // and nobody would get an error report.
  it('still resolves to the account, under its NEW handle', async () => {
    mockGetAdmin.mockReturnValue(
      adminReturning(null, {
        history: { profile_id: 'user-1' },
        byId: { id: 'user-1', username: 'user_a1b2c3d4e5f6', display_name: 'Mao' },
      }) as never
    );
    expect(await resolveLnurlRecipient('georgy.butaev')).toEqual({
      userId: 'user-1',
      username: 'user_a1b2c3d4e5f6',
      displayName: 'Mao',
    });
  });

  // The RPC lowercases and trims server-side, so callers cannot drift from the
  // stored form. The handle is passed through verbatim.
  it('hands the raw handle to the RPC, which canonicalises it', async () => {
    const stub = adminReturning(null, {
      history: { profile_id: 'user-1' },
      byId: { id: 'user-1', username: 'user_a1b2c3d4e5f6', display_name: null },
    });
    mockGetAdmin.mockReturnValue(stub as never);
    await resolveLnurlRecipient('Georgy.Butaev');
    expect(stub.rpcCalls[0]).toEqual({
      fn: 'resolve_username_history',
      args: { handle: 'Georgy.Butaev' },
    });
  });

  // THE regression. Two live profiles carry a '+' in their legacy handle. Sent
  // as a PostgREST filter the character becomes a space server-side, so the
  // owner was unfindable and a payment to that address had nowhere to go.
  // Measured on production: eq.butaeff+ocauth2 -> [], eq.butaeff%2Bocauth2 -> [row].
  it("finds an owner whose old handle contains '+'", async () => {
    const stub = adminReturning(null, {
      history: { profile_id: 'user-1' },
      byId: { id: 'user-1', username: 'user_cbd30e0570d3', display_name: null },
    });
    mockGetAdmin.mockReturnValue(stub as never);
    const recipient = await resolveLnurlRecipient('butaeff+ocauth2');
    expect(recipient?.userId).toBe('user-1');
    // Never a query-string filter — that is what mangled it.
    expect(stub.calls.some(c => c.table === 'profile_username_history')).toBe(false);
    expect(stub.rpcCalls[0].args).toEqual({ handle: 'butaeff+ocauth2' });
  });

  it('does not resolve when the account behind it is gone', async () => {
    mockGetAdmin.mockReturnValue(
      adminReturning(null, { history: { profile_id: 'user-1' }, byId: null }) as never
    );
    expect(await resolveLnurlRecipient('georgy.butaev')).toBeNull();
  });

  it('never uses a wildcard matcher on the profiles lookup', async () => {
    // `_` is legal in a username and ilike treats it as a wildcard, so
    // `user_823e4d9d2714` would also match `userX823e4d9d2714`. Exact only.
    const stub = adminReturning({ id: 'u', username: 'alice', display_name: 'A' });
    mockGetAdmin.mockReturnValue(stub as never);
    await resolveLnurlRecipient('Alice');
    expect(stub.calls[0]).toEqual({
      table: 'profiles',
      column: 'username_lower',
      value: 'alice',
    });
  });
});

describe('resolveLnurlRecipient', () => {
  it('returns null for an unknown username', async () => {
    mockGetAdmin.mockReturnValue(adminReturning(null) as never);
    expect(await resolveLnurlRecipient('ghost')).toBeNull();
  });

  it('returns null for a blank username without querying', async () => {
    expect(await resolveLnurlRecipient('   ')).toBeNull();
    expect(mockGetAdmin).not.toHaveBeenCalled();
  });

  it('resolves a known username to its owner', async () => {
    mockGetAdmin.mockReturnValue(
      adminReturning({ id: 'u1', username: 'satoshi', display_name: 'Satoshi' }) as never
    );
    expect(await resolveLnurlRecipient('SATOSHI')).toEqual({
      userId: 'u1',
      username: 'satoshi',
      displayName: 'Satoshi',
    });
  });
});

describe('resolveLnurlWallet', () => {
  it('returns null when the only wallet is on-chain (not a Lightning rail)', async () => {
    mockResolveWallet.mockResolvedValue({
      method: 'onchain',
      wallet_id: 'w1',
      onchain_address: 'bc1x',
    });
    expect(await resolveLnurlWallet('u1')).toBeNull();
  });

  it('returns null when the user has no wallet', async () => {
    mockResolveWallet.mockResolvedValue(null);
    expect(await resolveLnurlWallet('u1')).toBeNull();
  });

  it('returns a Lightning-capable wallet (nwc)', async () => {
    const wallet = { method: 'nwc' as const, wallet_id: 'w1', nwc_uri: 'nostr+walletconnect://x' };
    mockResolveWallet.mockResolvedValue(wallet);
    expect(await resolveLnurlWallet('u1')).toEqual(wallet);
  });
});

describe('buildLnurlMetadata', () => {
  it('produces a LUD-16 metadata array with plain text and identifier', () => {
    const meta = buildLnurlMetadata(
      { userId: 'u1', username: 'satoshi', displayName: 'Satoshi' },
      'orangecat.ch'
    );
    expect(JSON.parse(meta)).toEqual([
      ['text/plain', 'Pay Satoshi on OrangeCat'],
      ['text/identifier', 'satoshi@orangecat.ch'],
    ]);
  });
});
