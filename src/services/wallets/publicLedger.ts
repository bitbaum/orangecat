/**
 * What an opted-in wallet publishes: its balance, its recent transactions, and
 * the owner's note on each one.
 *
 * Three rules hold this together:
 *
 *   - NOTHING is published unless `open_accounting` is on AND the wallet is
 *     live. The switch is checked here, in the read, rather than trusted to the
 *     caller — a page that forgets the check would publish a private ledger.
 *   - The extended public key never leaves the server. It is read here to
 *     derive addresses and is not part of what is returned; only the resulting
 *     ledger is.
 *   - "We could not read the chain" is its own state. An empty transaction list
 *     means a wallet with no transactions; a failed lookup says so instead.
 *     Rendering the two identically is the mistake that made every xpub balance
 *     read 0.
 */

import { getAdminClient } from '@/lib/supabase/admin';
import { getTableName } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { fetchWalletTransactions, type OnchainTransaction } from '@/domain/wallets/onchainTransactions';
import { logger } from '@/utils/logger';

export interface PublicLedgerEntry extends OnchainTransaction {
  /** The owner's explanation of this transaction, when they wrote one. */
  note: string | null;
}

export interface PublicLedger {
  /** Null when the chain has never been read — not zero. */
  balanceBtc: number | null;
  balanceUpdatedAt: string | null;
  entries: PublicLedgerEntry[];
  /** True when the chain lookup failed, so an empty list is not "no activity". */
  couldNotRead: boolean;
}

interface LedgerRow {
  wallet_type: string | null;
  address_or_xpub: string | null;
  balance_btc: number | null;
  balance_updated_at: string | null;
  open_accounting: boolean | null;
  is_active: boolean | null;
}

/**
 * The published ledger for a wallet, or null when it publishes nothing.
 *
 * Null means "this wallet has not opted in" and is indistinguishable from
 * "no such wallet" on purpose: whether a given id exists is not something a
 * visitor needs, and the page renders the same either way.
 */
export async function readPublicLedger(walletId: string): Promise<PublicLedger | null> {
  let db;
  try {
    db = getAdminClient();
  } catch {
    return null;
  }

  const { data, error } = await db
    .from(getTableName('wallet'))
    .select('wallet_type, address_or_xpub, balance_btc, balance_updated_at, open_accounting, is_active')
    .eq('id', walletId)
    .maybeSingle();

  const wallet = data as LedgerRow | null;
  if (error || !wallet || !wallet.is_active || !wallet.open_accounting) {
    return null;
  }

  // Lightning wallets have no chain to read: a Lightning balance is not
  // derivable from an address, and refreshBalance rejects them outright. An
  // opted-in Lightning wallet therefore publishes its notes and nothing else,
  // rather than a confident zero.
  const readable = wallet.wallet_type === 'address' || wallet.wallet_type === 'xpub';

  let transactions: OnchainTransaction[] = [];
  let couldNotRead = false;
  if (readable && wallet.address_or_xpub) {
    try {
      transactions = await fetchWalletTransactions(wallet.wallet_type as string, wallet.address_or_xpub);
    } catch (err) {
      couldNotRead = true;
      logger.warn('Public ledger could not read the chain', {
        walletId,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  const { data: noteRows } = await db
    .from(DATABASE_TABLES.WALLET_TRANSACTION_NOTES)
    .select('txid, note')
    .eq('wallet_id', walletId);

  const notes = new Map<string, string>(
    ((noteRows as Array<{ txid: string; note: string }> | null) ?? []).map(n => [n.txid, n.note])
  );

  return {
    // Only meaningful for a wallet whose balance is read from the chain, and
    // only when it has actually been read.
    balanceBtc: readable && wallet.balance_updated_at ? wallet.balance_btc : null,
    balanceUpdatedAt: readable ? wallet.balance_updated_at : null,
    entries: transactions.map(tx => ({ ...tx, note: notes.get(tx.txid) ?? null })),
    couldNotRead,
  };
}
