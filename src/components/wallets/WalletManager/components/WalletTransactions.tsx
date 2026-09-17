'use client';

/**
 * On-chain history for one wallet.
 *
 * THREE DESIGN DECISIONS, and why:
 *
 * 1. LAZY, NOT EAGER. Reading history costs N requests to mempool.space — an
 *    extended key is a gap-limit scan, then one call per used address. Loading
 *    that for every card on page render would be slow and would burn the rate
 *    limit on wallets nobody looked at. So it loads when asked, once, and stays
 *    loaded. That also keeps the wallets page fast for the common case, where
 *    the owner just wants the balance.
 *
 * 2. "COULD NOT LOOK" IS NOT "NOTHING THERE". A failure renders as a failure,
 *    with a retry — never as an empty list. Collapsing those two into one blank
 *    state is exactly what let every xpub wallet report 0 BTC for months while
 *    holding real funds.
 *
 * 3. SEPARATE COMPONENT. WalletCard is at its size gate, and this owns a real
 *    state machine (idle → loading → error | empty | loaded) that has nothing
 *    to do with rendering a wallet's identity.
 */

import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Loader2, RefreshCw, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { formatDateTime } from '@/utils/locale';
import { logger } from '@/utils/logger';

interface OnchainTransaction {
  txid: string;
  netBtc: number;
  direction: 'in' | 'out';
  confirmed: boolean;
  blockTime: number | null;
  explorerUrl: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; transactions: OnchainTransaction[]; notes: Record<string, string> };

export function WalletTransactions({ walletId }: { walletId: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const { formatAmountBtc } = useDisplayCurrency();

  const load = async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch(API_ROUTES.WALLETS.TRANSACTIONS(walletId), {
        credentials: 'same-origin',
      });
      const body = await res.json();
      if (!res.ok || !body?.success) {
        throw new Error(apiErrorMessage(body, 'Could not read transactions from the blockchain'));
      }
      // The owner's own notes, loaded with the history rather than after it:
      // a row that pops a note in a moment later reads as a glitch.
      let notes: Record<string, string> = {};
      try {
        const noteRes = await fetch(API_ROUTES.WALLETS.NOTES(walletId), {
          credentials: 'same-origin',
        });
        const noteBody = await noteRes.json();
        if (noteRes.ok && noteBody?.success) {
          for (const n of noteBody.data?.notes ?? []) {
            notes[n.txid] = n.note;
          }
        }
      } catch {
        // A note that failed to load is not worth failing the history for.
        notes = {};
      }
      setState({ kind: 'loaded', transactions: body.data?.transactions ?? [], notes });
    } catch (error) {
      logger.error('Failed to load wallet transactions', { walletId, error });
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not read transactions right now',
      });
    }
  };

  if (state.kind === 'idle') {
    return (
      <button
        onClick={load}
        className="w-full min-h-11 rounded-lg border border-default px-3 py-2 text-sm font-medium text-fg-secondary transition-colors hover:border-strong hover:text-fg-primary"
      >
        Show transactions
      </button>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-default px-3 py-2 text-sm text-fg-secondary">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Reading the blockchain…
      </div>
    );
  }

  if (state.kind === 'error') {
    // Deliberately NOT an empty list. The owner is told we failed, and given
    // the one action that can fix it.
    return (
      <div className="rounded-lg border border-status-negative/30 bg-status-negative/5 p-3">
        <p className="text-sm text-status-negative">{state.message}</p>
        <button
          onClick={load}
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-fg-primary underline underline-offset-2"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }

  if (state.transactions.length === 0) {
    return (
      <p className="rounded-lg border border-default px-3 py-3 text-sm text-fg-secondary">
        No transactions yet — nothing has been sent to this wallet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-default">
      <ul className="divide-y divide-default">
        {state.transactions.map(tx => {
          const incoming = tx.direction === 'in';
          const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
          return (
            <li key={tx.txid}>
              <a
                href={tx.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                // One row at every width — no custom breakpoint needed. The
                // left side is `min-w-0` so a long date truncates instead of
                // pushing the amount off-screen, and the amount never shrinks.
                // (There is no `xs:` in this Tailwind config; using one would
                // have compiled to nothing and looked fine in the HTML.)
                className="flex min-h-11 items-center justify-between gap-3 p-3 transition-colors hover:bg-surface-raised"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon
                    className={`h-4 w-4 flex-shrink-0 ${
                      incoming ? 'text-status-positive' : 'text-fg-tertiary'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg-primary">
                      {incoming ? 'Received' : 'Sent'}
                    </span>
                    <span className="block truncate text-xs text-fg-secondary">
                      {tx.confirmed && tx.blockTime
                        ? formatDateTime(tx.blockTime * 1000)
                        : 'Pending confirmation'}
                    </span>
                  </span>
                </span>
                <span className="flex flex-shrink-0 items-center gap-1.5">
                  {/* Bitcoin Orange is reserved for Bitcoin amounts. */}
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      incoming ? 'text-bitcoinOrange' : 'text-fg-primary'
                    }`}
                  >
                    {incoming ? '+' : '−'}
                    {formatAmountBtc(Math.abs(tx.netBtc))}
                  </span>
                  <ExternalLink
                    className="h-3.5 w-3.5 flex-shrink-0 text-fg-tertiary"
                    aria-hidden="true"
                  />
                </span>
              </a>
              <TransactionNote
                walletId={walletId}
                txid={tx.txid}
                note={state.notes[tx.txid] ?? null}
                onSaved={next =>
                  setState(prev =>
                    prev.kind === 'loaded'
                      ? {
                          ...prev,
                          notes: next
                            ? { ...prev.notes, [tx.txid]: next }
                            : Object.fromEntries(
                                Object.entries(prev.notes).filter(([id]) => id !== tx.txid)
                              ),
                        }
                      : prev
                  )
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
function TransactionNote({
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
