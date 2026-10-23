/**
 * MoneyFigure — how an amount is set in type, once.
 *
 * The number is large and the unit is small. "CHF 19.78" in one weight is a
 * label; 19.78 big with CHF quietly beside it is a figure — the eye lands on
 * what moved, not on the currency code. It is the same rule everywhere an
 * amount is the point: the amount being entered, the sum on a receipt, the
 * figure on an invoice, a row in a list.
 *
 * It takes the already-formatted string (useDisplayCurrency decides the
 * currency and its spelling) and only splits it, so the figure can never
 * disagree with the rest of the app about what an amount looks like.
 */

import { cn } from '@/lib/utils';

export type MoneyFigureSize = 'hero' | 'lg' | 'md';

/** "CHF 19.78" → CHF · 19.78 · "", "0.00023 BTC" → "" · 0.00023 · BTC, "$1,234.50" → $ · 1,234.50 · "". */
export function splitMoney(label: string): { prefix: string; number: string; suffix: string } {
  const match = /^([^\d-]*?)\s*(-?\d[\d.,'’]*)\s*([^\d]*)$/.exec(label.trim());
  if (!match) {
    return { prefix: '', number: label, suffix: '' };
  }
  return { prefix: match[1].trim(), number: match[2], suffix: match[3].trim() };
}

const NUMBER: Record<MoneyFigureSize, string> = {
  hero: 'text-figure',
  lg: 'text-3xl',
  md: 'text-lg',
};
const UNIT: Record<MoneyFigureSize, string> = {
  hero: 'text-xl',
  lg: 'text-base',
  md: 'text-sm',
};

export function MoneyFigure({
  label,
  size = 'lg',
  className,
}: {
  /** The amount as the app formats it: "CHF 19.78". */
  label: string;
  size?: MoneyFigureSize;
  className?: string;
}) {
  const { prefix, number, suffix } = splitMoney(label);
  const unit = cn('font-medium text-fg-tertiary', UNIT[size]);

  return (
    <span className={cn('inline-flex items-baseline justify-center gap-1.5', className)}>
      {prefix && <span className={unit}>{prefix}</span>}
      <span
        className={cn(
          'font-heading font-semibold tabular-nums tracking-display text-fg-primary',
          NUMBER[size]
        )}
      >
        {number}
      </span>
      {suffix && <span className={unit}>{suffix}</span>}
    </span>
  );
}
