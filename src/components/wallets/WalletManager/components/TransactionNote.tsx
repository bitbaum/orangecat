'use client';

/**
 * What this transaction was for, in the owner's words.
 *
 * Its own file because WalletTransactions sits at the 300-line component gate —
 * the same reason WalletTransactions was split out of WalletCard. A note editor
 * owns a small state machine (idle -> editing -> saving) that has nothing to do
 * with listing history.
 */

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { logger } from '@/utils/logger';

/**
 * What this transaction was for, in the owner's words.
 *
 * Deliberately OUTSIDE the row's <a>: a text field nested inside a link is
 * unreachable by keyboard and steals the click. Clearing the text deletes the
 * note rather than saving an empty one, so "no note" stays one state instead of
 * two that look identical.
 *
 * The note is visible to visitors only while the wallet's open accounting is on
 * — the row-level policy checks that, not this component.
 */
export function TransactionNote({
  walletId,
  txid,
  note,
  onSaved,
}: {
  walletId: string;
  txid: string;
  note: string | null;
  onSaved: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = value.trim();
    setSaving(true);
    try {
      const res = await fetch(API_ROUTES.WALLETS.NOTES(walletId), {
        method: trimmed ? 'PUT' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(trimmed ? { txid, note: trimmed } : { txid }),
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(apiErrorMessage(body, 'Could not save that note'));
      }
      onSaved(trimmed);
      setEditing(false);
    } catch (error) {
      logger.error('Failed to save transaction note', { walletId, txid, error });
      toast.error(error instanceof Error ? error.message : 'Could not save that note');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => {
          setValue(note ?? '');
          setEditing(true);
        }}
        className="flex min-h-11 w-full items-center gap-1.5 px-3 pb-2 text-left text-xs text-fg-secondary transition-colors hover:text-fg-primary"
      >
        <Pencil className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        <span className="truncate">{note ?? 'Add a note'}</span>
      </button>
    );
  }

  return (
    <div className="px-3 pb-3">
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        maxLength={500}
        rows={2}
        autoFocus
        placeholder="What was this for?"
        className="w-full rounded-lg border border-default bg-surface-base p-2 text-sm text-fg-primary"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="min-h-11 rounded-lg bg-fg-primary px-3 text-sm font-medium text-surface-base disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="min-h-11 rounded-lg border border-default px-3 text-sm text-fg-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
