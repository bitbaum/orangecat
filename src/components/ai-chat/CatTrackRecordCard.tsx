'use client';

/**
 * Cat Track Record card — the transparency view of the outcome feedback loop.
 *
 * Shows what actually happened to the entities Cat created with this user
 * (created → published → funded), the same derived signal Cat itself sees in
 * its context. Lives in the Cat hub's Context tab: "what Cat knows" includes
 * what Cat's suggestions actually led to.
 */

import { TrendingUp } from 'lucide-react';
import { useCatTrackRecord } from '@/hooks/useCatTrackRecord';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import type { TrackRecordEntry } from '@/services/cat/track-record';

function statusClasses(entry: TrackRecordEntry): string {
  if (entry.status === 'active') {
    return 'text-status-positive';
  }
  return 'text-fg-tertiary';
}

function statusLabel(entry: TrackRecordEntry): string {
  if (entry.status === null) {
    return 'deleted';
  }
  return entry.status;
}

export function CatTrackRecordCard() {
  const { record, isLoading } = useCatTrackRecord();
  const { formatAmountBtc } = useDisplayCurrency();

  // Loading: keep the tab calm — a single skeleton bar, no spinner stack.
  if (isLoading) {
    return (
      <div className="h-24 animate-pulse rounded-md border border-subtle bg-surface-raised/40" />
    );
  }

  // Signal unavailable (no log access / error): the card simply doesn't exist.
  if (!record) {
    return null;
  }

  return (
    <div className="rounded-md border border-subtle bg-surface-page p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-fg-primary">
          <TrendingUp className="h-4 w-4 text-fg-secondary" aria-hidden />
          Track Record
        </h3>
        <span className="text-xs text-fg-tertiary">last {record.windowDays} days</span>
      </div>

      {record.proposed === 0 ? (
        <p className="text-sm text-fg-secondary">
          Nothing created together yet. When Cat creates products, projects, or services with you,
          their real outcomes — published, funded — show up here and sharpen Cat’s advice.
        </p>
      ) : (
        <>
          {/* Funnel: created → published → funded. Numbers stay readable at 320px. */}
          <dl className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ['Created', record.proposed],
                ['Published', record.published],
                ['Funded', record.funded],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-md bg-surface-raised/50 px-2 py-3">
                <dt className="text-xs text-fg-tertiary">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-fg-primary">{value}</dd>
              </div>
            ))}
          </dl>

          {record.totalFundedBtc > 0 && (
            <p className="mt-3 text-sm text-fg-secondary">
              Total received:{' '}
              <span className="font-medium text-fg-primary">
                {formatAmountBtc(record.totalFundedBtc)}
              </span>
            </p>
          )}

          <ul className="mt-4 divide-y divide-subtle border-t border-subtle">
            {record.entries.map(entry => {
              const meta = ENTITY_REGISTRY[entry.entityType];
              return (
                <li
                  key={entry.entityId}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg-primary">{entry.title}</p>
                    <p className="text-xs text-fg-tertiary">{meta?.name ?? entry.entityType}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3 text-xs">
                    <span className={statusClasses(entry)}>{statusLabel(entry)}</span>
                    {entry.fundedBtc > 0 && (
                      <span className="font-medium text-fg-primary">
                        {formatAmountBtc(entry.fundedBtc)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Loss side — the same setbacks Cat sees in its context. Rendered even
          when the funnel is empty: an all-denials record is still a record. */}
      {record.setbacks &&
        record.setbacks.failed + record.setbacks.denied + record.setbacks.unconfirmed > 0 && (
          <div className="mt-4 border-t border-subtle pt-3">
            <p className="text-xs text-fg-tertiary">
              Setbacks: {record.setbacks.failed} failed · {record.setbacks.denied} denied ·{' '}
              {record.setbacks.unconfirmed} unconfirmed
            </p>
            <ul className="mt-2 space-y-1">
              {record.setbacks.recent.map((s, i) => (
                <li key={`${s.actionId}-${s.at}-${i}`} className="text-xs text-fg-secondary">
                  <span className="font-medium text-fg-primary">{s.actionId}</span> — {s.kind}
                  {s.reason ? `: ${s.reason}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
}

export default CatTrackRecordCard;
