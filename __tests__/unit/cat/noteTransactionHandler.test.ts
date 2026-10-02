/**
 * `note_transaction` lets the owner explain a transaction by talking to the Cat.
 *
 * The property that matters most: a note is only saved against a transaction
 * the wallet actually has. The ledger renders notes only for entries it reads
 * from the chain, so a note on an invented or mistyped txid would be saved,
 * reported as done, and never appear — a success that is not one.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/domain/wallets/updateWallet', () => ({ fetchWalletAndVerifyOwner: vi.fn() }));
vi.mock('@/domain/wallets/onchainTransactions', () => ({ fetchWalletTransactions: vi.fn() }));
vi.mock('@/domain/wallets/transactionNotes', async importOriginal => ({
  ...(await importOriginal<typeof import('@/domain/wallets/transactionNotes')>()),
  saveTransactionNote: vi.fn(),
}));

import { walletLedgerHandlers } from '@/services/cat/handlers/wallet-ledger';
import { fetchWalletAndVerifyOwner } from '@/domain/wallets/updateWallet';
import { fetchWalletTransactions } from '@/domain/wallets/onchainTransactions';
import { saveTransactionNote } from '@/domain/wallets/transactionNotes';

const owner = fetchWalletAndVerifyOwner as Mock;
const chain = fetchWalletTransactions as Mock;
const save = saveTransactionNote as Mock;
const handler = walletLedgerHandlers.note_transaction;

const TX_A = 'ab12cd34' + '0'.repeat(56);
const TX_B = 'ab12cd35' + '1'.repeat(56);

const FUND = {
  id: 'w-fund',
  label: 'Aid fund',
  wallet_type: 'address',
  address_or_xpub: 'bc1qfund',
  open_accounting: true,
};
const LIGHTNING = {
  id: 'w-ln',
  label: 'Tips',
  wallet_type: 'lightning',
  address_or_xpub: null,
  open_accounting: false,
};

function supabaseWith(wallets: unknown[]) {
  const q: Record<string, unknown> = {};
  Object.assign(q, {
    select: () => q,
    eq: () => q,
    limit: async () => ({ data: wallets, error: null }),
  });
  return { from: () => q } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  owner.mockResolvedValue({ wallet: FUND, error: null });
  chain.mockResolvedValue([{ txid: TX_A }, { txid: TX_B }]);
  save.mockResolvedValue({ data: {}, error: null });
});

describe('note_transaction', () => {
  it('saves the note against the full txid matched from a prefix, and says it is public', async () => {
    const result = await handler(supabaseWith([FUND, LIGHTNING]), 'u1', 'a1', {
      txid: TX_A.slice(0, 10).toUpperCase(),
      note: 'Laptop for the course',
    });
    expect(result.success).toBe(true);
    expect(save).toHaveBeenCalledWith(expect.anything(), 'w-fund', TX_A, 'Laptop for the course');
    expect(result.data).toMatchObject({ wallet: 'Aid fund', txid: TX_A, public: true });
  });

  it('refuses a txid the wallet does not have, and saves nothing', async () => {
    const result = await handler(supabaseWith([FUND]), 'u1', 'a1', {
      txid: 'ffffffff',
      note: 'Invented',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No recent transaction/);
    expect(save).not.toHaveBeenCalled();
  });

  it('asks for more of the id when it is too short or matches two transactions', async () => {
    const short = await handler(supabaseWith([FUND]), 'u1', 'a1', { txid: 'ab12cd3', note: 'x' });
    expect(short.error).toMatch(/at least the first 8/);
    chain.mockResolvedValue([{ txid: TX_A }, { txid: 'ab12cd34' + '2'.repeat(56) }]);
    const ambiguous = await handler(supabaseWith([FUND]), 'u1', 'a1', {
      txid: 'ab12cd34',
      note: 'x',
    });
    expect(ambiguous.error).toMatch(/matches 2 transactions/);
    expect(save).not.toHaveBeenCalled();
  });

  it('never saves when the chain cannot be read', async () => {
    chain.mockRejectedValue(new Error('API_ERROR_502'));
    const result = await handler(supabaseWith([FUND]), 'u1', 'a1', { txid: TX_A, note: 'x' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/could not be confirmed/);
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses a Lightning wallet, which has no on-chain entries', async () => {
    const result = await handler(supabaseWith([FUND, LIGHTNING]), 'u1', 'a1', {
      wallet: 'tips',
      txid: TX_A,
      note: 'x',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no on-chain transactions/);
  });

  it('asks which wallet when the user has several Bitcoin wallets and named none', async () => {
    const second = { ...FUND, id: 'w-2', label: 'Savings' };
    const result = await handler(supabaseWith([FUND, second]), 'u1', 'a1', {
      txid: TX_A,
      note: 'x',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Say which wallet/);
  });

  it('refuses when the caller does not own the wallet', async () => {
    owner.mockResolvedValue({ wallet: null, error: {} });
    const result = await handler(supabaseWith([FUND]), 'u1', 'a1', { txid: TX_A, note: 'x' });
    expect(result.success).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('applies the same note rules as the notes API (empty, too long)', async () => {
    const empty = await handler(supabaseWith([FUND]), 'u1', 'a1', { txid: TX_A, note: '  ' });
    expect(empty.error).toMatch(/cannot be empty/);
    const long = await handler(supabaseWith([FUND]), 'u1', 'a1', {
      txid: TX_A,
      note: 'x'.repeat(501),
    });
    expect(long.error).toMatch(/at most 500/);
    expect(save).not.toHaveBeenCalled();
  });
});
