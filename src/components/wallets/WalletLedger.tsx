import { ArrowDownLeft, ArrowUpRight, ExternalLink } from 'lucide-react';
import { displayBTC } from '@/services/currency/formatting';
import { formatDateTime } from '@/utils/locale';
import type { PublicLedger } from '@/services/wallets/publicLedger';

/**
 * The published half of a wallet: what it holds, what moved, and why.
 *
 * Rendered only for a wallet whose owner turned open accounting on — the check
 * lives in readPublicLedger, which returns null otherwise, so this component
 * cannot publish a private ledger by being mounted in the wrong place.
 *
 * Every number here is stated with its provenance. A balance nobody has read is
 * an em dash, not a zero (the rule #946 set). A failed chain lookup says so,
 * because "no transactions" and "we could not look" must not render the same.
 */
export default function WalletLedger({ ledger }: { ledger: PublicLedger }) {
  return (
    <section className="mt-8" aria-labelledby="ledger-heading">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 id="ledger-heading" className="text-sm font-medium uppercase tracking-caps text-fg-secondary">
          Open accounting
        </h2>
        {ledger.balanceUpdatedAt && (
          <span className="text-xs text-fg-tertiary">
            checked {formatDateTime(ledger.balanceUpdatedAt)}
          </span>
        )}
      </div>

      {/* The score and the facts it is made of, together. A number on its own is
          a badge — which is precisely what the deleted 2026 score was, scoring
          booleans its own caller passed in. Showing the terms means a reader can
          disagree with the weighting and still check the arithmetic. */}
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {ledger.transparency.score !== null && (
          <span className="text-sm font-semibold text-fg-primary">
            Transparency {ledger.transparency.score}/100
          </span>
        )}
        <span className="text-xs text-fg-secondary">
          {ledger.transparency.total > 0
            ? `${ledger.transparency.explained} of ${ledger.transparency.total} transactions explained`
            : 'no transactions to explain yet'}
          {ledger.transparency.balanceFresh === true && ' · balance current'}
          {ledger.transparency.balanceFresh === false && ' · balance not checked recently'}
        </span>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-raised p-5">
        <div className="text-xs uppercase tracking-caps text-fg-secondary mb-1">Balance</div>
        <div
          className={`text-2xl font-semibold ${
            ledger.balanceBtc !== null ? 'text-fg-primary' : 'text-fg-tertiary'
          }`}
        >
          {ledger.balanceBtc !== null ? displayBTC(ledger.balanceBtc) : '—'}
        </div>
        {ledger.balanceBtc === null && (
          <div className="text-xs text-fg-secondary mt-1">Not checked yet</div>
        )}
      </div>

      <h3 className="text-sm font-medium text-fg-primary mt-6 mb-3">Recent transactions</h3>

      {ledger.couldNotRead ? (
        <p className="text-sm text-fg-secondary">
          The blockchain could not be reached just now, so this list is incomplete rather than
          empty. Try again shortly.
        </p>
      ) : ledger.entries.length === 0 ? (
        <p className="text-sm text-fg-secondary">No transactions yet.</p>
      ) : (
        <ul className="space-y-3">
          {ledger.entries.map(entry => {
            const incoming = entry.direction === 'in';
            return (
              <li
                key={entry.txid}
                className="rounded-xl border border-border-default bg-surface-raised p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {incoming ? (
                      <ArrowDownLeft className="w-4 h-4 text-status-positive shrink-0" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-fg-secondary shrink-0" />
                    )}
                    <span
                      className={`font-semibold ${
                        incoming ? 'text-status-positive' : 'text-fg-primary'
                      }`}
                    >
                      {incoming ? '+' : ''}
                      {displayBTC(entry.netBtc)}
                    </span>
                  </div>
                  <div className="text-xs text-fg-tertiary text-right shrink-0">
                    {entry.confirmed && entry.blockTime
                      ? formatDateTime(new Date(entry.blockTime * 1000).toISOString())
                      : 'Unconfirmed'}
                  </div>
                </div>

                {/* The owner's own words. Without them a ledger is a list of
                    numbers that explains nothing — which is the whole reason
                    this feature exists rather than a link to a block explorer. */}
                {entry.note ? (
                  <p className="text-sm text-fg-primary mt-2">{entry.note}</p>
                ) : (
                  <p className="text-sm text-fg-tertiary mt-2 italic">No note</p>
                )}

                <a
                  href={entry.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-fg-secondary hover:text-fg-primary transition-colors mt-2"
                >
                  Verify on mempool.space
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
