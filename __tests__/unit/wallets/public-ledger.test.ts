/**
 * What an opted-in wallet publishes — and, more importantly, what a wallet that
 * has NOT opted in must never publish.
 *
 * The switch is checked inside the read, not by the page. A page that forgot
 * the check would publish somebody's balance and their entire transaction
 * history; making the reader return null is what makes that impossible rather
 * than merely unlikely.
 */

const rows: Record<string, unknown> = {};
let walletRow: Record<string, unknown> | null = null;
let noteRows: Array<{ txid: string; note: string }> = [];
let transactions: unknown[] = [];
let throwOnChainRead = false;

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/domain/wallets/onchainTransactions', () => ({
  fetchWalletTransactions: async () => {
    if (throwOnChainRead) {
      throw new Error('API_ERROR_502');
    }
    return transactions;
  },
}));

vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({
    from: (table: string) => {
      if (table === 'wallet_transaction_notes') {
        return { select: () => ({ eq: async () => ({ data: noteRows, error: null }) }) };
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: walletRow, error: null }) }),
        }),
      };
    },
  }),
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readPublicLedger } from '@/services/wallets/publicLedger';

const TXID = 'a'.repeat(64);

function tx(overrides: Record<string, unknown> = {}) {
  return {
    txid: TXID,
    netBtc: 0.0006058,
    direction: 'in',
    confirmed: true,
    blockTime: 1_700_000_000,
    explorerUrl: `https://mempool.space/tx/${TXID}`,
    ...overrides,
  };
}

beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k];
  walletRow = {
    wallet_type: 'address',
    address_or_xpub: 'bc1qexample',
    balance_btc: 0.0006058,
    balance_updated_at: '2026-09-17T08:00:00.000Z',
    open_accounting: true,
    is_active: true,
  };
  noteRows = [];
  transactions = [tx()];
  throwOnChainRead = false;
});

describe('readPublicLedger', () => {
  it('publishes nothing for a wallet whose owner has not opted in', async () => {
    walletRow = { ...walletRow, open_accounting: false };
    expect(await readPublicLedger('w1')).toBeNull();
  });

  it('publishes nothing for a deactivated wallet, even if the flag is on', async () => {
    // Soft-deleting a wallet has to take its ledger down with it; otherwise
    // "delete" leaves the financial history published forever.
    walletRow = { ...walletRow, is_active: false };
    expect(await readPublicLedger('w1')).toBeNull();
  });

  it('publishes balance and transactions when opted in', async () => {
    const ledger = await readPublicLedger('w1');
    expect(ledger?.balanceBtc).toBeCloseTo(0.0006058, 8);
    expect(ledger?.entries).toHaveLength(1);
    expect(ledger?.couldNotRead).toBe(false);
  });

  it('reports an unchecked balance as unknown, never as zero', async () => {
    // The rule #946 set for wallet cards, applied to the public ledger: a
    // balance nobody has read is an em dash, and `null` is what carries that.
    walletRow = { ...walletRow, balance_btc: 0, balance_updated_at: null };
    const ledger = await readPublicLedger('w1');
    expect(ledger?.balanceBtc).toBeNull();
  });

  it('attaches the owner note to the transaction it belongs to', async () => {
    noteRows = [{ txid: TXID, note: 'Paid the December server bill' }];
    const ledger = await readPublicLedger('w1');
    expect(ledger?.entries[0].note).toBe('Paid the December server bill');
  });

  it('leaves a transaction with no note explicitly null', async () => {
    noteRows = [{ txid: 'b'.repeat(64), note: 'a different transaction' }];
    const ledger = await readPublicLedger('w1');
    expect(ledger?.entries[0].note).toBeNull();
  });

  it('says it could not read the chain rather than showing an empty ledger', async () => {
    // "No transactions" and "we could not look" must not render identically —
    // an empty list under a funded wallet is the confidently wrong state.
    throwOnChainRead = true;
    const ledger = await readPublicLedger('w1');
    expect(ledger?.couldNotRead).toBe(true);
    expect(ledger?.entries).toEqual([]);
    // And no transparency score either: scoring an empty list produced by a
    // FAILED lookup would turn a network error into a verdict about a person.
    expect(ledger?.transparency.score).toBeNull();
  });

  it('does not invent a chain balance for a Lightning wallet', async () => {
    // A Lightning balance is not derivable from an address, and refreshBalance
    // refuses these outright — so an opted-in Lightning wallet publishes no
    // balance rather than a confident zero.
    walletRow = {
      ...walletRow,
      wallet_type: 'lightning',
      address_or_xpub: null,
      balance_btc: 0,
      balance_updated_at: '2026-09-17T08:00:00.000Z',
    };
    const ledger = await readPublicLedger('w1');
    expect(ledger?.balanceBtc).toBeNull();
    expect(ledger?.entries).toEqual([]);
  });
});
