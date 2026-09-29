/**
 * A tax formula as data.
 *
 * A country's income tax is a list of components. Each component reads a
 * tariff from one level of government and, optionally, multiplies it by the sum
 * of multipliers read from other levels. Which levels exist, what they are
 * called and which metric keys they publish belong to the country's pack in
 * Solon; this file knows none of them. A country whose tax has a different
 * shape is a different model, never a branch in the evaluator.
 *
 * Facts are the numbers for one period: a tariff or a multiplier, keyed by the
 * level and metric a component names. The caller resolves which facts are
 * current for the place and period; the evaluator only combines them.
 */

export const TAX_MODEL_SCHEMA_VERSION = 1;

/** Where a component reads a number: the fact a level publishes under a metric key. */
export interface FactRef {
  level: string;
  metric: string;
}

export interface MultiplierRef extends FactRef {
  /** When the fact is missing, count it as zero instead of making the estimate incomplete. */
  optional?: boolean;
  /** A boolean input that must be true for this multiplier to count. */
  when?: string;
}

export interface TaxComponent {
  /** Unique within the model; the result reports each component under it. */
  key: string;
  tariff: FactRef;
  /**
   * Summed, then applied to the tariff amount. Absent: the tariff amount is
   * the tax.
   */
  multipliers?: readonly MultiplierRef[];
  /** A boolean input that must be true for this component to apply at all. */
  when?: string;
}

export interface TaxModel {
  schemaVersion: typeof TAX_MODEL_SCHEMA_VERSION;
  /** The input the tariffs are applied to. Must be listed in `inputs`. */
  base: string;
  /** Every input the model reads: the base amount and any boolean conditions. */
  inputs: readonly string[];
  /** Which tariff variant applies (for example by household). At least one. */
  variants: readonly string[];
  components: readonly TaxComponent[];
}

export interface Bracket {
  /** The amount from which this marginal rate applies. */
  from: number;
  /** Marginal rate as a fraction (0.02 = 2%). */
  rate: number;
}

interface TariffBase {
  /** ISO 4217. Every tariff one estimate reads must share it. */
  currency: string;
  /** Upper bound on the tariff amount, in `currency`. */
  cap?: number;
}

export type Tariff =
  | (TariffBase & { kind: 'progressive'; brackets: readonly Bracket[] })
  | (TariffBase & { kind: 'flat'; rate: number });

/** One number for one period. At most one fact per (level, metric, variant). */
export interface Fact {
  level: string;
  metric: string;
  /** Absent: the fact applies to every variant. */
  variant?: string;
  /** A tariff for a component's `tariff`, a fraction (1.19 = 119%) for a multiplier. */
  value: Tariff | number;
}

/** Why a model cannot be evaluated, one line per problem; empty when it can. */
export function modelProblems(model: TaxModel): string[] {
  const problems: string[] = [];
  if (model.schemaVersion !== TAX_MODEL_SCHEMA_VERSION) {
    problems.push(`schemaVersion ${String(model.schemaVersion)} is not supported`);
  }
  if (!model.inputs.includes(model.base)) {
    problems.push(`base "${model.base}" is not listed in inputs`);
  }
  if (model.variants.length === 0) {
    problems.push('variants is empty');
  }
  if (model.components.length === 0) {
    problems.push('components is empty');
  }
  const seen = new Set<string>();
  for (const component of model.components) {
    if (seen.has(component.key)) {
      problems.push(`component "${component.key}" is declared twice`);
    }
    seen.add(component.key);
    const conditions = [component.when, ...(component.multipliers ?? []).map(m => m.when)];
    for (const condition of conditions) {
      if (condition !== undefined && !model.inputs.includes(condition)) {
        problems.push(`component "${component.key}" reads undeclared input "${condition}"`);
      }
    }
  }
  return problems;
}

/** Why a tariff is not usable, or null when it is. */
export function tariffProblem(tariff: Tariff): string | null {
  if (!/^[A-Z]{3}$/.test(tariff.currency)) {
    return `currency "${tariff.currency}" is not an ISO 4217 code`;
  }
  if (tariff.cap !== undefined && !(tariff.cap >= 0)) {
    return 'cap is negative';
  }
  if (tariff.kind === 'flat') {
    return isRate(tariff.rate) ? null : `rate ${tariff.rate} is outside [0, 1]`;
  }
  if (tariff.brackets.length === 0) {
    return 'brackets is empty';
  }
  for (let i = 0; i < tariff.brackets.length; i++) {
    const bracket = tariff.brackets[i]!;
    if (!isRate(bracket.rate)) {
      return `bracket ${i} rate ${bracket.rate} is outside [0, 1]`;
    }
    if (!(bracket.from >= 0)) {
      return `bracket ${i} starts below zero`;
    }
    if (i > 0 && !(bracket.from > tariff.brackets[i - 1]!.from)) {
      return `bracket ${i} does not start above bracket ${i - 1}`;
    }
  }
  return null;
}

function isRate(rate: number): boolean {
  return rate >= 0 && rate <= 1;
}
