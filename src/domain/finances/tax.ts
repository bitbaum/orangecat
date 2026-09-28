/**
 * Progressive income tax from a bracket table — pure, and only as good as the
 * table (src/config/tax-estimates.ts), which says so itself.
 */
import type { TaxBracket, TaxTable } from '@/config/tax-estimates';

/** Sum of marginal layers: each bracket's rate on the income above its floor, up to the next floor. */
export function progressiveTax(income: number, brackets: readonly TaxBracket[]): number {
  if (!(income > 0)) {
    return 0;
  }
  const sorted = [...brackets].sort((a, b) => a.from - b.from);
  let tax = 0;
  for (let i = 0; i < sorted.length; i++) {
    const floor = sorted[i].from;
    const ceiling = i + 1 < sorted.length ? sorted[i + 1].from : Infinity;
    if (income <= floor) {
      break;
    }
    tax += (Math.min(income, ceiling) - floor) * sorted[i].rate;
  }
  return tax;
}

export interface TaxEstimate {
  table: TaxTable;
  taxableIncome: number;
  federal: number;
  /** Basic cantonal tariff times the sum of multipliers. */
  cantonalAndCommunal: number;
  total: number;
  /** total / taxableIncome, 0 when there is no income. */
  effectiveRate: number;
}

export function estimateIncomeTax(taxableIncome: number, table: TaxTable): TaxEstimate {
  const income = Math.max(0, Math.round(taxableIncome));
  const federal = progressiveTax(income, table.federal);
  const basic = progressiveTax(income, table.cantonalBasic);
  const factor = table.multipliers.reduce((sum, m) => sum + m.factor, 0);
  const cantonalAndCommunal = basic * factor;
  const total = federal + cantonalAndCommunal;
  return {
    table,
    taxableIncome: income,
    federal: Math.round(federal),
    cantonalAndCommunal: Math.round(cantonalAndCommunal),
    total: Math.round(total),
    effectiveRate: income > 0 ? total / income : 0,
  };
}
