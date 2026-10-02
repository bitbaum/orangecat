/**
 * What query_my_data("wallets") tells the Cat about each wallet's ledger.
 *
 * Pinned: unexplained entries are listed with their FULL txid (note_transaction
 * needs one and the Cat must never invent it), the score is the ledger page's
 * own scoreLedger and is only quoted for a wallet that publishes, and a failed
 * chain read is said, never shown as an empty ledger.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/domain/wallets/onchainTransactions', () => ({ fetchWalletTransactions: vi.fn() }));

import { ledgerSection } from '@/services/cat/my-data-ledger';
import { fetchWalletTransactions } from '@/domain/wallets/onchainTransactions';

const chain = fetchWalletTransactions as Mock;
const TX_A = 'a'.repeat(64);
const TX_B = 'b'.repeat(64);

let wallets: unknown[] = [];
let notes: Array<{ txid: string; note: string }> = [];

const supabase = {
  from: (table: string) => {
    const q: Record<string, unknown> = {};
    if (table === 'wallet_transaction_notes') {
      Object.assign(q, { select: () => q, eq: async () => ({ data: notes, error: null }) });
      return q;
    }
    Object.assign(q, {
      select: () => q,
      eq: () => q,
      in: () => q,
      limit: async () => ({ data: wallets, error: null }),
    });
    return q;
  },
} as never;

const fund = {
  id: 'w1',
  label: 'Aid fund',
  wallet_type: 'address',
  address_or_xpub: 'bc1qfund',
  open_accounting: true,
  balance_updated_at: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  wallets = [fund];
  notes = [{ txid: TX_A, note: 'Laptop for the course' }];
  chain.mockResolvedValue([
    { txid: TX_A, netBtc: 0.002, direction: 'in', confirmed: true, blockTime: 1_759_000_000 },
    { txid: TX_B, netBtc: -0.001, direction: 'out', confirmed: true, blockTime: 1_759_100_000 },
  ]);
});

describe('ledgerSection', () => {
  it('lists unexplained entries with full txids and quotes the published score', async () => {
    const text = await ledgerSection(supabase, 'u1');
    expect(text).toContain('"Aid fund": publishes its ledger');
    expect(text).toContain('1 of 2 recent transactions explained');
    expect(text).toMatch(/transparency \d+\/100/);
    expect(text).toContain(`txid ${TX_B}`);
    expect(text).toContain('-0.001 BTC');
    expect(text).not.toContain(`txid ${TX_A}`);
  });

  it('does not quote a score for a private ledger', async () => {
    wallets = [{ ...fund, open_accounting: false }];
    const text = await ledgerSection(supabase, 'u1');
    expect(text).toContain('ledger private');
    expect(text).not.toMatch(/transparency/);
  });

  it('says so when the chain cannot be read, instead of an empty ledger', async () => {
    chain.mockRejectedValue(new Error('API_ERROR_502'));
    const text = await ledgerSection(supabase, 'u1');
    expect(text).toContain('could not be read from the blockchain');
    expect(text).not.toContain('0 of 0');
  });

  it('says there is nothing to explain when the user has no on-chain wallet', async () => {
    wallets = [];
    await expect(ledgerSection(supabase, 'u1')).resolves.toMatch(
      /no Bitcoin address or key wallets/
    );
  });
});
