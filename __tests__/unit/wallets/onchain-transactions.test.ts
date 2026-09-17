/**
 * On-chain history must report what MOVED, not what it touched.
 *
 * A transaction that merely involves one of your addresses says nothing. The
 * number a person reads as "I received 60,580 sats" is the NET for this wallet:
 * outputs paid to it minus inputs spent from it. Get that wrong and the history
 * is confidently misleading — the same failure shape as the xpub balance that
 * reported 0 for a funded wallet.
 */

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

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
import { fetchWalletTransactions } from '@/domain/wallets/onchainTransactions';

const OURS = 'bc1qours';
const THEIRS = 'bc1qtheirs';

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

describe('on-chain transactions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports the net received, not the transaction total', async () => {
    global.fetch = vi.fn(async (url: unknown) => {
      if (String(url).endsWith('/txs')) {
        return ok([
          {
            txid: 'tx1',
            // A 1 BTC transaction that pays us only 0.0006058.
            vin: [{ prevout: { scriptpubkey_address: THEIRS, value: 100_000_000 } }],
            vout: [
              { scriptpubkey_address: OURS, value: 60_580 },
              { scriptpubkey_address: THEIRS, value: 99_939_420 },
            ],
            status: { confirmed: true, block_time: 1_700_000_000 },
          },
        ]);
      }
      return ok({ chain_stats: { tx_count: 1 } });
    }) as unknown as typeof fetch;

    const txs = await fetchWalletTransactions('address', OURS);

    expect(txs).toHaveLength(1);
    expect(txs[0].netBtc).toBeCloseTo(0.0006058, 8);
    expect(txs[0].direction).toBe('in');
    expect(txs[0].explorerUrl).toBe('https://mempool.space/tx/tx1');
  });

  it('reports a spend as negative', async () => {
    global.fetch = vi.fn(async (url: unknown) => {
      if (String(url).endsWith('/txs')) {
        return ok([
          {
            txid: 'tx2',
            vin: [{ prevout: { scriptpubkey_address: OURS, value: 200_000 } }],
            vout: [
              { scriptpubkey_address: THEIRS, value: 150_000 },
              { scriptpubkey_address: OURS, value: 40_000 }, // change back
            ],
            status: { confirmed: true, block_time: 1_700_000_100 },
          },
        ]);
      }
      return ok({ chain_stats: { tx_count: 1 } });
    }) as unknown as typeof fetch;

    const txs = await fetchWalletTransactions('address', OURS);

    // Sent 200k, got 40k change back → net -160k sats, NOT -200k and not +40k.
    expect(txs[0].netBtc).toBeCloseTo(-0.0016, 8);
    expect(txs[0].direction).toBe('out');
  });

  it('counts a transaction once when it touches several of our addresses', async () => {
    const tx = {
      txid: 'shared',
      vin: [],
      vout: [
        { scriptpubkey_address: 'addr0', value: 1000 },
        { scriptpubkey_address: 'addr1', value: 2000 },
      ],
      status: { confirmed: true, block_time: 1_700_000_200 },
    };
    global.fetch = vi.fn(async (url: unknown) => {
      const s = String(url);
      if (s.endsWith('/txs')) return ok([tx]);
      // addr0 and addr1 used, then the gap limit of empties.
      const m = s.match(/addr(\d+)$/);
      const i = m ? Number(m[1]) : 99;
      return ok({ chain_stats: { tx_count: i < 2 ? 1 : 0 } });
    }) as unknown as typeof fetch;

    const txs = await fetchWalletTransactions('xpub', 'zpubDEADBEEF');

    expect(txs).toHaveLength(1);
    // Netted across BOTH our outputs, not double-counted and not halved.
    expect(txs[0].netBtc).toBeCloseTo(0.00003, 8);
  });

  it('nets a spend against change that landed on the change chain', async () => {
    // The bug this pins: the change output goes to chain 1, which the scan
    // never derived, so `owned` did not contain it and the spend netted as the
    // WHOLE input sent — 200k out, when 160k actually left the wallet.
    global.fetch = vi.fn(async (url: unknown) => {
      const s = String(url);
      if (s.endsWith('/txs')) {
        return ok([
          {
            txid: 'spend-with-change',
            vin: [{ prevout: { scriptpubkey_address: 'addr0', value: 200_000 } }],
            vout: [
              { scriptpubkey_address: THEIRS, value: 150_000 },
              { scriptpubkey_address: 'chg0', value: 40_000 },
            ],
            status: { confirmed: true, block_time: 1_700_000_300 },
          },
        ]);
      }
      const used = s.endsWith('addr0') || s.endsWith('chg0');
      return ok({ chain_stats: { tx_count: used ? 1 : 0 } });
    }) as unknown as typeof fetch;

    const txs = await fetchWalletTransactions('xpub', 'zpubDEADBEEF');

    expect(txs).toHaveLength(1);
    expect(txs[0].netBtc).toBeCloseTo(-0.0016, 8);
    expect(txs[0].direction).toBe('out');
  });

  it('treats an address with only unconfirmed activity as used', async () => {
    // A payment still in the mempool is exactly the one an owner is watching
    // for. The scan counted chain_stats alone, so a first payment to a fresh
    // address was invisible until it confirmed — while the result list already
    // sorted unconfirmed transactions first, which only makes sense if they
    // can appear at all.
    global.fetch = vi.fn(async (url: unknown) => {
      const s = String(url);
      if (s.endsWith('/txs')) {
        return ok([
          {
            txid: 'pending',
            vin: [{ prevout: { scriptpubkey_address: THEIRS, value: 100_000 } }],
            vout: [{ scriptpubkey_address: 'addr0', value: 90_000 }],
            status: { confirmed: false },
          },
        ]);
      }
      return ok({
        chain_stats: { tx_count: 0 },
        mempool_stats: { tx_count: s.endsWith('addr0') ? 1 : 0 },
      });
    }) as unknown as typeof fetch;

    const txs = await fetchWalletTransactions('xpub', 'zpubDEADBEEF');

    expect(txs).toHaveLength(1);
    expect(txs[0].confirmed).toBe(false);
    expect(txs[0].netBtc).toBeCloseTo(0.0009, 8);
  });

  it('throws rather than returning an empty list when the chain cannot be read', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    // "No transactions" and "we could not look" must not render identically.
    await expect(fetchWalletTransactions('address', OURS)).rejects.toThrow(/API_ERROR/);
  });
});
