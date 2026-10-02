import { DATABASE_TABLES } from '@/config/database-tables';
import { fetchWalletAndVerifyOwner } from '@/domain/wallets/updateWallet';
import { fetchWalletTransactions } from '@/domain/wallets/onchainTransactions';
import {
  normalizeTxid,
  noteValidationError,
  saveTransactionNote,
} from '@/domain/wallets/transactionNotes';
import type { ActionHandler } from './types';

/** Shortest txid prefix accepted from the model: long enough to be unambiguous in 25 entries. */
const MIN_TXID_PREFIX = 8;
const ONCHAIN_TYPES = new Set(['address', 'xpub']);

interface OwnWallet {
  id: string;
  label: string;
  wallet_type: string | null;
  address_or_xpub: string | null;
  open_accounting: boolean | null;
}

export const walletLedgerHandlers: Record<string, ActionHandler> = {
  /**
   * The owner says what a transaction was for — through the Cat.
   *
   * Open accounting publishes a wallet's ledger with the owner's note on each
   * entry, and the transparency score is mostly the share of entries that
   * carry one. Writing those notes one form at a time is the chore that keeps
   * the share low; saying "the 0.002 last Tuesday was Amina's laptop" is not.
   *
   * The txid is checked against the wallet's actual recent history before the
   * note is saved. The ledger only renders notes for transactions it reads
   * from the chain, so a note on a mistyped or invented txid would be saved,
   * reported as done, and never appear anywhere — the worst kind of success.
   */
  note_transaction: async (supabase, userId, _actorId, params) => {
    const note = typeof params.note === 'string' ? params.note.trim() : '';
    const wanted = normalizeTxid(params.txid);
    if (wanted.length < MIN_TXID_PREFIX || !/^[0-9a-f]+$/.test(wanted)) {
      return {
        success: false,
        error: `txid is required — at least the first ${MIN_TXID_PREFIX} characters of the transaction id, as listed by query_my_data("wallets").`,
      };
    }

    const { data, error } = await supabase
      .from(DATABASE_TABLES.WALLETS)
      .select('id, label, wallet_type, address_or_xpub, open_accounting')
      .eq('profile_id', userId)
      .eq('is_active', true)
      .limit(20);
    if (error) {
      return { success: false, error: 'Could not read your wallets right now.' };
    }
    const wallets = (data ?? []) as OwnWallet[];
    const label = typeof params.wallet === 'string' ? params.wallet.trim().toLowerCase() : '';
    const matches = label
      ? wallets.filter(w => w.label.trim().toLowerCase() === label)
      : wallets.filter(w => ONCHAIN_TYPES.has(w.wallet_type ?? ''));
    if (matches.length !== 1) {
      const names = wallets.map(w => `"${w.label}"`).join(', ') || 'none';
      return {
        success: false,
        error: label
          ? `No single wallet is named "${params.wallet}". The user's wallets: ${names}.`
          : `Say which wallet the transaction belongs to. The user's wallets: ${names}.`,
      };
    }
    const wallet = matches[0];
    if (!ONCHAIN_TYPES.has(wallet.wallet_type ?? '') || !wallet.address_or_xpub) {
      return {
        success: false,
        error: `"${wallet.label}" is not a Bitcoin address or key, so it has no on-chain transactions to explain.`,
      };
    }

    // One owner test for every wallet write, the same one the notes API uses.
    const owner = await fetchWalletAndVerifyOwner(supabase, wallet.id, userId, 'annotate');
    if (owner.error) {
      return { success: false, error: 'You can only explain transactions on your own wallets.' };
    }

    let recent;
    try {
      recent = await fetchWalletTransactions(wallet.wallet_type!, wallet.address_or_xpub);
    } catch {
      return {
        success: false,
        error:
          'Could not read this wallet from the blockchain right now, so the transaction could not be confirmed. Try again shortly.',
      };
    }
    const hits = recent.filter(tx => tx.txid.startsWith(wanted));
    if (hits.length !== 1) {
      return {
        success: false,
        error:
          hits.length === 0
            ? `No recent transaction on "${wallet.label}" starts with ${wanted}. Only the latest ${recent.length} can be explained here.`
            : `${wanted} matches ${hits.length} transactions on "${wallet.label}" — give more of the id.`,
      };
    }
    const txid = hits[0].txid;

    const invalid = noteValidationError(txid, note);
    if (invalid) {
      return { success: false, error: invalid };
    }

    const saved = await saveTransactionNote(supabase, wallet.id, txid, note);
    if (saved.error) {
      return { success: false, error: 'The note could not be saved.' };
    }
    return {
      success: true,
      data: {
        wallet: wallet.label,
        txid,
        note,
        // Whether anyone else can read it. Said back so the Cat never implies
        // a private note was published, or a public one kept private.
        public: wallet.open_accounting === true,
      },
    };
  },
};
