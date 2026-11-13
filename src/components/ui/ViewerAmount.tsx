'use client';

/**
 * ViewerAmount — an amount stored in one currency, shown in the viewer's.
 *
 * A loan listed in dollars read "$500.00" to a Swiss visitor whose pay boxes
 * all speak francs (2026-11-13 review). The amount is converted through
 * Bitcoin at the live rate and shown the way every other money figure is
 * (`formatAmountBtc`, the viewer's preference). With `detail`, a quiet line
 * under it keeps what was actually listed and the Bitcoin it is worth, so the
 * conversion never hides the terms. Without a rate it shows the stored amount
 * as stored: a guessed rate is the one bug nobody notices.
 */

import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { formatCurrency } from '@/services/currency';

interface ViewerAmountProps {
  /** In `currency` units. */
  amount: number;
  /** What the amount is stored in ('USD', 'CHF', 'BTC'). */
  currency: string;
  /** Add "Listed as USD 500.00 · ₿0.0047" under the figure. */
  detail?: boolean;
  className?: string;
}

export function ViewerAmount({
  amount: raw,
  currency,
  detail = false,
  className,
}: ViewerAmountProps) {
  const { formatAmountBtc, displayCurrency } = useDisplayCurrency();
  // NUMERIC columns can arrive as strings.
  const amount = Number(raw);
  const { convertToBTC } = useCurrencyConversion();
  const stored = currency.toUpperCase();
  const btc = stored === 'BTC' ? amount : convertToBTC(amount, stored);

  if (!(btc > 0) || stored === displayCurrency) {
    const asStored = formatCurrency(amount, stored);
    return (
      <span className={className}>
        {asStored}
        {detail && btc > 0 && stored !== 'BTC' && (
          <span className="block text-xs font-normal text-fg-secondary">
            {formatCurrency(btc, 'BTC')}
          </span>
        )}
      </span>
    );
  }

  const parts = [
    stored !== 'BTC' ? `Listed as ${formatCurrency(amount, stored)}` : null,
    displayCurrency !== 'BTC' ? formatCurrency(btc, 'BTC') : null,
  ].filter(Boolean);
  return (
    <span className={className}>
      ≈ {formatAmountBtc(btc)}
      {detail && parts.length > 0 && (
        <span className="block text-xs font-normal text-fg-secondary">{parts.join(' · ')}</span>
      )}
    </span>
  );
}
