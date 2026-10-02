/**
 * The owner's note on a wallet transaction — one rule set for every writer.
 *
 * Two surfaces write notes: the notes API (the wallet manager UI) and the Cat
 * (`note_transaction`). Both must accept the same txids, refuse the same
 * notes and correct rather than stack, or the ledger page would show notes
 * one path could never have produced. The table's CHECK constraints are the
 * last line; these are the same limits, said in words a person can act on.
 *
 * Writes go through the CALLER's client so row-level security has the final
 * say on ownership even if a caller skipped its own check.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';

/** A bitcoin txid is 32 bytes rendered as 64 lowercase hex characters. */
export const TXID_PATTERN = /^[0-9a-f]{64}$/;
export const MAX_NOTE_LENGTH = 500;

export function normalizeTxid(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/** Why a txid/note pair cannot be saved, or null when it can. */
export function noteValidationError(txid: string, note: string): string | null {
  if (!TXID_PATTERN.test(txid)) {
    return 'txid must be 64 hexadecimal characters';
  }
  if (!note) {
    return 'A note cannot be empty — delete it instead';
  }
  if (note.length > MAX_NOTE_LENGTH) {
    return `A note is at most ${MAX_NOTE_LENGTH} characters`;
  }
  return null;
}

/**
 * One note per transaction: writing again corrects it rather than stacking a
 * second opinion under the same number.
 */
export async function saveTransactionNote(
  supabase: AnySupabaseClient,
  walletId: string,
  txid: string,
  note: string
) {
  return supabase
    .from(DATABASE_TABLES.WALLET_TRANSACTION_NOTES)
    .upsert(
      { wallet_id: walletId, txid, note, updated_at: new Date().toISOString() },
      { onConflict: 'wallet_id,txid' }
    )
    .select('txid, note, updated_at')
    .single();
}
