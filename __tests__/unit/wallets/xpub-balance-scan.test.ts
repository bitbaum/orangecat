/**
 * An xpub balance must be measured, not assumed.
 *
 * `fetchXpubBalance` called `mempool.space/api/v1/xpub/<key>` — an endpoint
 * that DOES NOT EXIST. Every variant 404s (verified 2026-09-07), and the code
 * mapped 404 to `return 0`. So every xpub wallet reported exactly
 * 0.00000000 BTC forever, and the card stamped it "Updated <time>": a number
 * nobody had measured, presented as freshly read from the blockchain.
 *
 * A wallet holding funds looked empty. That is the one failure a balance
 * display must never have — an honest "we could not read it" is recoverable,
 * a confident wrong zero is not.
 */

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Derivation is exercised for real elsewhere; here it only needs to be
// deterministic so the scan's shape can be asserted.
vi.mock('@/domain/payments/addressDerivation', () => ({
  RECEIVE_CHAIN: 0,
  CHANGE_CHAIN: 1,
  SCANNED_CHAINS: [0, 1],
  deriveOnchainAddress: (_key: string, index: number) => `addr${index}`,
  // `addrN` is the receive chain, `chgN` the change chain — so an assertion can
  // say which chain a scan actually walked.
  deriveChainAddress: (_key: string, chain: number, index: number) =>
    chain === 0 ? `addr${index}` : `chg${index}`,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';

/** chain_stats for an address, in the shape mempool.space returns. */
function stats(balanceSats: number, txCount: number) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      chain_stats: { funded_txo_sum: balanceSats, spent_txo_sum: 0, tx_count: txCount },
      mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0, tx_count: 0 },
    }),
  };
}

const empty = () => stats(0, 0);

describe('xpub balance is scanned, never assumed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sums used addresses on BOTH chains', async () => {
    const funded: Record<string, ReturnType<typeof stats>> = {
      addr0: stats(150_000, 2),
      addr1: stats(50_000, 1),
      // Change comes home to the internal chain. Scanning chain 0 alone left
      // this out, so a wallet that had spent always reported less than it held.
      chg0: stats(30_000, 1),
    };
    global.fetch = vi.fn(async (url: unknown) => {
      const m = String(url).match(/(?:addr|chg)\d+/);
      return (m && funded[m[0]]) || empty();
    }) as unknown as typeof fetch;

    const { refreshWalletBalance } = await import('@/domain/wallets/refreshBalance');
    const supabase = {
      from: () => ({
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            eq: () => ({
              select: () => ({ single: async () => ({ data: { ...patch }, error: null }) }),
            }),
          }),
        }),
      }),
    };

    const res = await refreshWalletBalance(supabase as never, 'w1', 'u1', {
      wallet_type: 'xpub',
      address_or_xpub: 'zpubDEADBEEF',
    });

    expect(res.ok).toBe(true);
    // The regression: this was 0 for any xpub, no matter what it held.
    expect((res as { wallet: Record<string, unknown> }).wallet.balance_btc).toBeCloseTo(0.0023, 8);
  });

  it('never reports a balance it could not read', async () => {
    // The old code turned this exact response into "0.00000000 BTC, updated now".
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const { refreshWalletBalance } = await import('@/domain/wallets/refreshBalance');
    const res = await refreshWalletBalance({} as never, 'w1', 'u1', {
      wallet_type: 'xpub',
      address_or_xpub: 'zpubDEADBEEF',
    });

    expect(res.ok).toBe(false);
    expect((res as { code: string }).code).toBe('API_ERROR');
  });

  it('stops after the gap limit rather than scanning forever', async () => {
    const seen: string[] = [];
    global.fetch = vi.fn(async (url: unknown) => {
      const m = String(url).match(/(?:addr|chg)\d+/);
      if (m) seen.push(m[0]);
      return empty();
    }) as unknown as typeof fetch;

    const { refreshWalletBalance } = await import('@/domain/wallets/refreshBalance');
    const supabase = {
      from: () => ({
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            eq: () => ({
              select: () => ({ single: async () => ({ data: { ...patch }, error: null }) }),
            }),
          }),
        }),
      }),
    };

    await refreshWalletBalance(supabase as never, 'w1', 'u1', {
      wallet_type: 'xpub',
      address_or_xpub: 'zpubDEADBEEF',
    });

    // 20 consecutive empties per chain and then it stops — not the 60-address
    // ceiling, and not 20 across both: a receive-chain gap says nothing about
    // whether the change chain has been used.
    expect(seen.filter(a => a.startsWith('addr'))).toHaveLength(20);
    expect(seen.filter(a => a.startsWith('chg'))).toHaveLength(20);
    expect(seen.length).toBe(40);
  });

  it('finds funds that live only on the change chain', async () => {
    // The regression, at its starkest: a wallet whose entire remaining balance
    // is change reported 0.00000000 BTC while holding money.
    global.fetch = vi.fn(async (url: unknown) => {
      const m = String(url).match(/(?:addr|chg)\d+/);
      return m && m[0] === 'chg0' ? stats(75_000, 1) : empty();
    }) as unknown as typeof fetch;

    const { refreshWalletBalance } = await import('@/domain/wallets/refreshBalance');
    const supabase = {
      from: () => ({
        update: (patch: Record<string, unknown>) => ({
          eq: () => ({
            eq: () => ({
              select: () => ({ single: async () => ({ data: { ...patch }, error: null }) }),
            }),
          }),
        }),
      }),
    };

    const res = await refreshWalletBalance(supabase as never, 'w1', 'u1', {
      wallet_type: 'xpub',
      address_or_xpub: 'zpubDEADBEEF',
    });

    expect((res as { wallet: Record<string, unknown> }).wallet.balance_btc).toBeCloseTo(
      0.00075,
      8
    );
  });
});
