'use client';

/**
 * CatCreditsPanel — your Bitcoin-paid Cat credit balance + ledger history.
 *
 * Balance is BTC (canonical unit), shown via the user's display currency. Top-up
 * (Lightning) is offered only when the platform receiving wallet is configured
 * (topupEnabled); otherwise the button stays disabled. See
 * docs/architecture/CAT_CREDITS.md.
 */

import { useCallback, useEffect, useState } from 'react';
import { Coins, Loader2, AlertCircle, ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { displayBTC } from '@/services/currency';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { TopUpDialog, type TopUpInvoiceView } from './TopUpDialog';
import { formatDate } from '@/utils/dates';

interface CreditEntry {
  id: string;
  kind: 'topup' | 'usage' | 'grant' | 'refund' | 'adjustment';
  amount_btc: number;
  balance_after_btc: number;
  created_at: string;
}

const KIND_LABELS: Record<CreditEntry['kind'], string> = {
  topup: 'Top-up',
  usage: 'Cat usage',
  grant: 'Included credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
};

export function CatCreditsPanel() {
  const { formatAmountBtc } = useDisplayCurrency();
  const [balanceBtc, setBalanceBtc] = useState(0);
  const [entries, setEntries] = useState<CreditEntry[]>([]);
  const [topupEnabled, setTopupEnabled] = useState(false);
  const [pendingTopup, setPendingTopup] = useState<TopUpInvoiceView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  /** Set when the dialog is opened to RESUME `pendingTopup` rather than start fresh. */
  const [resuming, setResuming] = useState<TopUpInvoiceView | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.CAT.CREDITS);
      if (!res.ok) {
        throw new Error('Failed to load credits');
      }
      const json = await res.json();
      setBalanceBtc(json?.data?.balanceBtc ?? 0);
      setEntries((json?.data?.entries ?? []) as CreditEntry[]);
      setTopupEnabled(!!json?.data?.topupEnabled);
      setPendingTopup((json?.data?.pendingTopup ?? null) as TopUpInvoiceView | null);
    } catch (err) {
      logger.error('Failed to load cat credits', err, 'CatCredits');
      setError('Could not load your credits. Try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-lg border border-default bg-surface-base p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-md bg-surface-raised p-2">
          <Coins className="h-5 w-5 text-fg-secondary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-fg-primary">Cat Credits</h2>
          <p className="mt-1 text-sm text-fg-secondary">
            Pay with Bitcoin to run Cat on frontier models — no card, no per-provider accounts.
            Credits are priced near cost; OrangeCat earns from platform activity, not your AI bill.
          </p>
        </div>
      </div>

      {/* Balance */}
      <div className="mb-4 flex items-center justify-between rounded-md border border-subtle bg-surface-raised/30 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-fg-tertiary">Balance</p>
          {isLoading ? (
            <Loader2 className="mt-1 h-5 w-5 animate-spin text-fg-secondary" />
          ) : (
            <p className="mt-0.5 text-2xl font-semibold text-fg-primary">
              {formatAmountBtc(balanceBtc)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setResuming(null);
            setTopUpOpen(true);
          }}
          disabled={!topupEnabled}
          title={topupEnabled ? 'Top up with Lightning' : 'Lightning top-up is coming soon'}
          className={
            topupEnabled
              ? 'rounded-md bg-accent-warm px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-warm-hover'
              : 'cursor-not-allowed rounded-md border border-subtle px-4 py-2 text-sm font-medium text-fg-tertiary opacity-60'
          }
        >
          {topupEnabled ? 'Top up' : 'Top up (soon)'}
        </button>
      </div>

      {/* An invoice issued earlier and still payable. Without this the only
          handle on it was the dialog's own state, so closing the modal made a
          live invoice unreachable and invisible. */}
      {pendingTopup && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-subtle bg-surface-raised/30 p-3">
          <span className="flex items-center gap-2 text-sm text-fg-secondary">
            <Clock className="h-4 w-4 text-status-warning" />
            {displayBTC(pendingTopup.amountBtc)} invoice waiting for payment
          </span>
          <button
            type="button"
            onClick={() => {
              setResuming(pendingTopup);
              setTopUpOpen(true);
            }}
            className="rounded-md border border-subtle px-3 py-1.5 text-sm text-fg-primary hover:bg-surface-raised"
          >
            Show invoice
          </button>
        </div>
      )}

      {/* History */}
      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-subtle bg-surface-raised/30 p-4">
          <span className="flex items-center gap-2 text-sm text-status-negative">
            <AlertCircle className="h-4 w-4" /> {error}
          </span>
          <button
            type="button"
            onClick={load}
            className="rounded-md border border-subtle px-3 py-1.5 text-sm text-fg-secondary hover:bg-surface-raised"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? null : entries.length === 0 ? (
        <p className="text-sm text-fg-tertiary">
          No credit activity yet. {topupEnabled ? 'Top up' : 'Once top-up is live'} to run Cat on
          frontier models; purchases and usage will show here.
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {entries.map(e => {
            const credit = e.amount_btc >= 0;
            return (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2 text-fg-primary">
                  {credit ? (
                    <ArrowDownLeft className="h-4 w-4 text-status-positive" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-fg-tertiary" />
                  )}
                  {KIND_LABELS[e.kind]}
                  <span className="text-fg-tertiary">
                    {formatDate(e.created_at)}
                  </span>
                </span>
                <span className={credit ? 'text-status-positive' : 'text-fg-secondary'}>
                  {credit ? '+' : '−'}
                  {formatAmountBtc(Math.abs(e.amount_btc))}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {topUpOpen && (
        <TopUpDialog
          initialInvoice={resuming}
          onClose={() => {
            setTopUpOpen(false);
            // Refresh so a top-up created and then closed shows up as pending
            // rather than vanishing until the next page load.
            void load();
          }}
          onSuccess={() => {
            setTopUpOpen(false);
            void load();
          }}
        />
      )}
    </section>
  );
}

export default CatCreditsPanel;
