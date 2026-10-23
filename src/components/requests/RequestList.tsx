'use client';

/**
 * One side of the request ledger — what you owe, or what you are owed.
 *
 * Every row leads with the amount and names the other person. An earlier
 * version listed bare amounts and statuses, which is unreadable: "0.0005 BTC ·
 * Pending" gives you nothing to decide with.
 *
 * An incoming request carries its own Pay button, so answering "someone asked
 * me for money" never depends on still having their notification.
 */

import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import type { PaymentRequestRow } from '@/services/payment-requests/request-client';
import { REQUEST_COPY } from '@/config/payment-requests';
import { buildPayUrl, payLinkOrigin } from '@/config/pay';

const STATUS_STYLES: Record<PaymentRequestRow['status'], string> = {
  pending: 'text-fg-secondary',
  paid: 'text-status-positive',
  declined: 'text-fg-tertiary',
  cancelled: 'text-fg-tertiary',
};

export function RequestList({
  title,
  emptyText,
  emptyIcon: EmptyIcon,
  rows,
  direction,
  onClose,
}: {
  title: string;
  emptyText: string;
  emptyIcon: LucideIcon;
  rows: PaymentRequestRow[];
  direction: 'incoming' | 'outgoing';
  onClose: (id: string) => void;
}) {
  const { formatAmountBtc } = useDisplayCurrency();

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-caps text-fg-tertiary">
        {title}
      </h2>

      {rows.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-subtle px-3 py-4 text-sm text-fg-tertiary">
          <EmptyIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {emptyText}
        </p>
      ) : (
        <ul className="divide-y divide-subtle rounded-lg border border-subtle">
          {rows.map(row => {
            const name = row.counterparty_name ?? REQUEST_COPY.unknownParty;
            return (
              <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-fg-primary">{formatAmountBtc(row.amount_btc)}</p>
                  <p className="truncate text-sm text-fg-secondary">
                    {direction === 'incoming' ? REQUEST_COPY.from(name) : REQUEST_COPY.to(name)}
                    {row.note ? ` · ${row.note}` : ''}
                  </p>
                  <p className={`text-xs ${STATUS_STYLES[row.status]}`}>
                    {REQUEST_COPY.statusLabels[row.status]}
                  </p>
                </div>

                {row.status === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    {/* The ask is a suggestion: the pay page opens prefilled and
                        stays editable, exactly like a shared pay link. */}
                    {direction === 'incoming' && row.counterparty_username && (
                      <Button
                        variant="primary"
                        size="sm"
                        href={buildPayUrl(payLinkOrigin(), row.counterparty_username, {
                          amountBtc: row.amount_btc,
                          note: row.note ?? undefined,
                          requestId: row.id,
                        })}
                      >
                        {REQUEST_COPY.pay}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => onClose(row.id)}>
                      {direction === 'incoming' ? REQUEST_COPY.decline : REQUEST_COPY.cancel}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
