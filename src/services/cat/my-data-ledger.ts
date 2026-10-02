/**
 * The ledger half of query_my_data("wallets"): for each of the user's Bitcoin
 * wallets, whether it publishes its ledger, its transparency score as the
 * ledger page computes it, and the recent transactions that still have no
 * note — with full txids, because note_transaction needs one and the Cat must
 * never invent it.
 *
 * Reads the chain (mempool.space, server-side), so it is part of the
 * "wallets" topic only and never of "overview". Capped at a few wallets, and
 * every failure is said rather than shown as an empty ledger: "no
 * transactions" and "could not look" must not read the same.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { fetchWalletTransactions } from '@/domain/wallets/onchainTransactions';
import { scoreLedger } from '@/services/wallets/transparency';
import type { AnySupabaseClient } from '@/lib/supabase/types';

const MAX_WALLETS = 3;
const MAX_UNEXPLAINED_LISTED = 10;

interface LedgerWallet {
  id: string;
  label: string;
  wallet_type: string | null;
  address_or_xpub: string | null;
  open_accounting: boolean | null;
  balance_updated_at: string | null;
}

async function walletLedgerLines(supabase: AnySupabaseClient, w: LedgerWallet): Promise<string> {
  const visibility = w.open_accounting
    ? 'publishes its ledger (notes are public)'
    : 'ledger private (notes visible only to the owner)';
  const head = `- "${w.label}": ${visibility}`;

  let transactions;
  try {
    transactions = await fetchWalletTransactions(w.wallet_type!, w.address_or_xpub!);
  } catch {
    return `${head}; transactions could not be read from the blockchain right now.`;
  }

  const { data: noteRows, error } = await supabase
    .from(DATABASE_TABLES.WALLET_TRANSACTION_NOTES)
    .select('txid, note')
    .eq('wallet_id', w.id);
  if (error) {
    return `${head}; notes could not be read right now.`;
  }
  const notes = new Map(
    ((noteRows ?? []) as Array<{ txid: string; note: string }>).map(n => [n.txid, n.note])
  );
  const entries = transactions.map(tx => ({ ...tx, note: notes.get(tx.txid) ?? null }));
  const t = scoreLedger(entries, w.balance_updated_at);

  const lines = [
    `${head}; ${t.explained} of ${t.total} recent transactions explained` +
      (w.open_accounting && t.score !== null ? `; transparency ${t.score}/100` : ''),
  ];
  const unexplained = entries.filter(e => !e.note);
  for (const e of unexplained.slice(0, MAX_UNEXPLAINED_LISTED)) {
    const when = e.blockTime
      ? new Date(e.blockTime * 1000).toISOString().slice(0, 10)
      : 'unconfirmed';
    const amount = `${e.direction === 'out' ? '-' : '+'}${Number(Math.abs(e.netBtc).toFixed(8))} BTC`;
    lines.push(`  - no note: ${amount} on ${when}, txid ${e.txid}`);
  }
  if (unexplained.length > MAX_UNEXPLAINED_LISTED) {
    lines.push(`  - …and ${unexplained.length - MAX_UNEXPLAINED_LISTED} more without a note`);
  }
  return lines.join('\n');
}

export async function ledgerSection(supabase: AnySupabaseClient, userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from(DATABASE_TABLES.WALLETS)
      .select('id, label, wallet_type, address_or_xpub, open_accounting, balance_updated_at')
      .eq('profile_id', userId)
      .eq('is_active', true)
      .in('wallet_type', ['address', 'xpub'])
      .limit(MAX_WALLETS);
    if (error) {
      return 'LEDGERS: could not be read right now.';
    }
    const wallets = ((data ?? []) as LedgerWallet[]).filter(w => w.address_or_xpub);
    if (wallets.length === 0) {
      return 'LEDGERS: no Bitcoin address or key wallets, so no on-chain transactions to explain.';
    }
    const blocks = await Promise.all(wallets.map(w => walletLedgerLines(supabase, w)));
    return `LEDGERS (explain an entry with note_transaction):\n${blocks.join('\n')}`;
  } catch {
    return 'LEDGERS: could not be read right now.';
  }
}
