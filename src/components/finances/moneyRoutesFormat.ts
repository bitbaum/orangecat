/**
 * Shared shapes and words for "Where your money goes" — the view and the
 * editor both read a line the same way, from here.
 */
import { COMPONENT_STYLES } from '@/config/design-system';
import { FINANCES_PAGE } from '@/config/finances';
import type { RouteView } from '@/domain/money-routes/service';
import { cn } from '@/lib/utils';
import { APP_LOCALE } from '@/utils/locale';

export const ROUTES_COPY = FINANCES_PAGE.routes;

/** A wallet a line may send to, as the page shows it. */
export interface RouteWallet {
  id: string;
  label: string;
  icon: string;
}

/** One line while it is being edited — inputs hold text until saved. */
export interface DraftLine {
  walletId: string;
  kind: 'share' | 'fill';
  sharePercent: string;
  targetAmount: string;
  targetCurrency: string;
  period: 'once' | 'monthly';
}

/** What the server says the rule now is — the answer to a GET or a save. */
export interface RouteOverview {
  lines: RouteView[];
  next: string | null;
}

export function formatAmount(value: number, currency: string): string {
  if (currency === 'BTC') {
    return `${value.toFixed(8)} BTC`;
  }
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function toDraft(line: RouteView): DraftLine {
  return {
    walletId: line.walletId,
    kind: line.kind,
    sharePercent: line.shareBps === null ? '' : String(line.shareBps / 100),
    targetAmount: line.targetAmount === null ? '' : String(line.targetAmount),
    targetCurrency: line.targetCurrency ?? 'CHF',
    period: line.period,
  };
}

export function ruleText(line: RouteView): string {
  if (line.kind === 'share') {
    return ROUTES_COPY.share((line.shareBps ?? 0) / 100);
  }
  const target = formatAmount(line.targetAmount ?? 0, line.targetCurrency ?? 'CHF');
  return line.period === 'monthly' ? ROUTES_COPY.fillMonthly(target) : ROUTES_COPY.fillOnce(target);
}

/** A native select that looks like the shared Input. */
export const selectClass = cn(COMPONENT_STYLES.field.control, 'block h-10 w-full px-3 text-sm');
