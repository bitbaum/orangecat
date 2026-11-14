'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { ORDER_COPY, ORDER_STATUS_LABEL } from '@/config/orders';
import { ROUTES } from '@/config/routes';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { useDisplayDate } from '@/hooks/useDisplayDate';
import { displayBTC } from '@/services/currency';
import type { MyOrder } from '@/domain/commerce/orders';

/** One paid order, from the reader's side: what, who, how much, their note. */
export function OrderCard({ order }: { order: MyOrder }) {
  const { formatAmountBtc, displayCurrency } = useDisplayCurrency();
  const { formatDate } = useDisplayDate();
  const selling = order.role === 'seller';
  const who = order.counterpartyName || ORDER_COPY.someone;
  const when = order.paidAt ?? order.createdAt;

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div className="min-w-0">
            <p className="mb-0 truncate font-medium text-fg-primary">{order.title}</p>
            <p className="mb-0 text-sm text-fg-secondary">
              {selling ? ORDER_COPY.soldTo : ORDER_COPY.boughtFrom}{' '}
              {order.counterpartyUsername ? (
                <Link
                  href={ROUTES.PROFILES.VIEW(order.counterpartyUsername)}
                  className="underline underline-offset-2"
                >
                  {who}
                </Link>
              ) : (
                who
              )}
              {order.guest && ` (${ORDER_COPY.noAccount})`}
              {when && <> · {formatDate(when)}</>}
            </p>
          </div>
          <p className="mb-0 shrink-0 text-sm text-fg-secondary">
            <span className="font-medium text-fg-primary">{formatAmountBtc(order.amountBtc)}</span>
            {displayCurrency !== 'BTC' && (
              <span className="tabular-nums"> · {displayBTC(order.amountBtc)}</span>
            )}{' '}
            · {ORDER_STATUS_LABEL[order.status]}
          </p>
        </div>

        {(order.buyerNote || (selling && order.guest)) && (
          <div className="rounded-md border border-subtle bg-surface-raised/40 px-3 py-2">
            {order.buyerNote ? (
              <>
                <p className="mb-0 text-xs font-medium uppercase tracking-label text-fg-tertiary">
                  {selling ? ORDER_COPY.noteFromBuyer : ORDER_COPY.yourNote}
                </p>
                <p className="mb-0 mt-1 whitespace-pre-wrap text-sm text-fg-primary break-words">
                  {order.buyerNote}
                </p>
              </>
            ) : (
              <p className="mb-0 text-sm text-fg-secondary">{ORDER_COPY.guestNoNote}</p>
            )}
          </div>
        )}

        <p className="mb-0 flex flex-wrap items-center gap-x-3 text-xs text-fg-tertiary">
          <span className="tabular-nums">{ORDER_COPY.ref(order.ref)}</span>
          {order.bookingId && (
            <Link
              href={ROUTES.DASHBOARD.BOOKINGS_VIEW(order.bookingId)}
              className="-my-3 inline-flex min-h-11 items-center underline underline-offset-2 hover:text-fg-secondary"
            >
              {ORDER_COPY.booking}
            </Link>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
