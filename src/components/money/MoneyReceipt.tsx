'use client';

/**
 * MoneyReceipt — the confirmation moment, shared by every money surface.
 *
 * A payment app is judged on this screen. Before it existed we showed a static
 * tick and the word "Sent", which answers none of the questions a person
 * actually has the instant money leaves: how much, to whom, and when. Every
 * consumer money app answers all three at once, because the alternative is the
 * user re-opening their wallet to check we were telling the truth.
 *
 * So the receipt states the facts it can prove, and stays silent about the ones
 * it can't — a Lightning invoice with no amount really does settle without us
 * learning the figure, and inventing one would be worse than omitting it.
 *
 * Three channels of feedback, deliberately redundant: the tick animates in
 * (motion draws the eye), the phone buzzes (works when the screen isn't being
 * watched), and the numbers are stated in words. Any one of them can be missed.
 */

import { useEffect, useState } from 'react';
import { MoneyDetailList } from '@/components/money/MoneyDetailList';
import { MoneyFigure } from '@/components/money/MoneyFigure';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { haptic } from '@/lib/haptics';
import { APP_LOCALE } from '@/utils/locale';

interface MoneyReceiptProps {
  /** Past-tense outcome, e.g. "Sent" / "Paid". */
  title: string;
  /** Omitted when we genuinely don't know it — never guessed. */
  amountBtc?: number | null;
  /** Who the money moved between, already formatted for display. */
  counterparty?: string | null;
  /** Preposition-style label for the counterparty row: "To", "From". */
  counterpartyLabel?: string;
  /** The reason the payment existed, if one was attached. */
  note?: string | null;
  /** Fallback line when there is no amount/counterparty detail to show. */
  fallbackBody?: string;
  /** Actions — "Send another", "Done". */
  children?: React.ReactNode;
}

export function MoneyReceipt({
  title,
  amountBtc,
  counterparty,
  counterpartyLabel = 'To',
  note,
  fallbackBody,
  children,
}: MoneyReceiptProps) {
  const { formatAmountBtc } = useDisplayCurrency();
  // Settled *now* — read on the client so the server never renders a time that
  // is already stale by the time it reaches the screen.
  const [settledAt, setSettledAt] = useState<string | null>(null);

  useEffect(() => {
    setSettledAt(
      new Date().toLocaleString(APP_LOCALE, {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
      })
    );
    haptic('success');
  }, []);

  const hasDetail = (amountBtc ?? null) !== null || !!counterparty;

  const hasAmount = amountBtc !== null && amountBtc !== undefined;

  return (
    <div className="flex flex-col items-center gap-5 py-10 text-center">
      {/* Drawn, not dropped in: the ring closes, then the tick lands. */}
      <svg
        viewBox="0 0 64 64"
        className="h-16 w-16 text-status-positive"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle className="oc-receipt-ring" cx="32" cy="32" r="29" pathLength="1" />
        <path className="oc-receipt-check" d="M20 33l8 8 16-17" pathLength="1" />
      </svg>

      {/* With an amount, the amount is the headline and the outcome a quiet line
          above it; without one, the outcome is all there is to say. */}
      <div className="space-y-2">
        {hasAmount ? (
          <>
            <p className="mb-0 text-base font-medium text-fg-secondary">{title}</p>
            <MoneyFigure label={formatAmountBtc(amountBtc as number)} size="hero" />
          </>
        ) : (
          <p className="mb-0 font-heading tracking-display text-2xl font-bold text-fg-primary">
            {title}
          </p>
        )}
      </div>

      {hasDetail ? (
        <MoneyDetailList
          className="max-w-xs"
          rows={[
            { label: counterpartyLabel, value: counterparty },
            { label: 'For', value: note },
            { label: 'When', value: settledAt },
          ]}
        />
      ) : (
        fallbackBody && <p className="mb-0 max-w-xs text-sm text-fg-secondary">{fallbackBody}</p>
      )}

      {children && <div className="flex flex-wrap justify-center gap-3 pt-1">{children}</div>}
    </div>
  );
}
