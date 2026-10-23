'use client';

/**
 * Every door this account accepts money through, as one list.
 *
 * The first row is Bitcoin — the rail OrangeCat runs itself: the link and the
 * Lightning name are the same door, and the coins land in the wallet the owner
 * connected. The rows after it are the other apps the owner is paid in; they
 * settle outside OrangeCat, which the line under the list says.
 *
 * Every row has the same shape: what it is, the handle under it, then who
 * sees it and what a payer learns — the identity cost, in the same words on
 * the Bitcoin row as on a Twint row — and one action on the right of the same
 * size. Adding one is the last row, not a button somewhere else.
 */

import { Plus } from 'lucide-react';
import { RailGlyph } from '@/components/payment/RailGlyph';
import { Button } from '@/components/ui/Button';
import {
  BITCOIN_RAIL,
  PAYMENT_METHODS,
  PAYMENT_METHODS_COPY,
  payerLearns,
} from '@/config/payment-methods';
import { RECEIVE_COPY } from '@/config/receive';
import { ROUTES } from '@/config/routes';
import { formatPaymentHandle } from '@/lib/payments/payment-handle';
import type { PaymentMethodRow } from '@/services/payment-methods/payment-methods-client';

interface WaysToPayProps {
  bitcoin: {
    /** <username>@orangecat.ch when it mints invoices, else null. */
    address: string | null;
    /** The handle a payer learns and nothing else: "@cato". */
    handle: string;
    /** The wallet the coins settle into, when we can name it. */
    arrivesAt: string | null;
    /** Whether any Bitcoin rail is set up at all. */
    active: boolean;
  };
  methods: PaymentMethodRow[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  removingId?: string | null;
}

const ROW = 'flex items-center gap-3 px-4 py-4';
const ACTION = 'shrink-0';

export function WaysToPay({ bitcoin, methods, onAdd, onRemove, removingId }: WaysToPayProps) {
  const bitcoinLine = !bitcoin.active
    ? PAYMENT_METHODS_COPY.bitcoinNotSetUp
    : bitcoin.arrivesAt
      ? PAYMENT_METHODS_COPY.bitcoinArrives(bitcoin.arrivesAt)
      : PAYMENT_METHODS_COPY.bitcoinArrivesInApp;

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-caps text-fg-tertiary">
        {PAYMENT_METHODS_COPY.heading}
      </h2>

      <ul className="divide-y divide-subtle rounded-lg border border-subtle bg-surface-base">
        <li className={ROW}>
          <RailGlyph kind="bitcoin" className="self-start" />
          <div className="min-w-0 flex-1">
            <p className="mb-0 font-medium text-fg-primary">{BITCOIN_RAIL.name}</p>
            {bitcoin.address && (
              <p className="mb-0 truncate font-mono text-sm text-fg-secondary">{bitcoin.address}</p>
            )}
            <p className="mb-0 text-xs text-fg-tertiary">
              {bitcoinLine}
              {bitcoin.active && ` · ${payerLearns(BITCOIN_RAIL.reveals, bitcoin.handle)}`}
            </p>
          </div>
          <Button variant="ghost" size="sm" href={ROUTES.DASHBOARD.WALLETS} className={ACTION}>
            {bitcoin.active ? RECEIVE_COPY.manageBitcoin : RECEIVE_COPY.setUpBitcoin}
          </Button>
        </li>

        {methods.map(row => {
          const kind = PAYMENT_METHODS[row.method];
          return (
            <li key={row.id} className={ROW}>
              <RailGlyph kind={kind.handleKind} className="self-start" />
              <div className="min-w-0 flex-1">
                <p className="mb-0 font-medium text-fg-primary">
                  {kind.name}
                  {row.label && <span className="text-fg-secondary"> · {row.label}</span>}
                </p>
                <p className="mb-0 truncate font-mono text-sm text-fg-secondary">
                  {formatPaymentHandle(row.method, row.handle)}
                </p>
                <p className="mb-0 text-xs text-fg-tertiary">
                  {PAYMENT_METHODS_COPY.visibilityWord[row.visibility]} ·{' '}
                  {payerLearns(kind.reveals)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className={ACTION}
                onClick={() => onRemove(row.id)}
                isLoading={removingId === row.id}
                aria-label={`${PAYMENT_METHODS_COPY.remove} ${kind.name}`}
              >
                {PAYMENT_METHODS_COPY.remove}
              </Button>
            </li>
          );
        })}

        <li>
          <button
            type="button"
            onClick={onAdd}
            className="flex min-h-12 w-full items-center gap-2 px-4 text-sm font-medium text-fg-primary hover:bg-surface-raised"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {PAYMENT_METHODS_COPY.add}
          </button>
        </li>
      </ul>

      <p className="mb-0 mt-2 text-sm text-fg-tertiary">{PAYMENT_METHODS_COPY.outsideNote}</p>
    </section>
  );
}
