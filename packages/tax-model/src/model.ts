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

/**
 * 2 adds a component's `divisor`; 3 adds the `stepped` and `average` tariffs;
 * 4 adds a tariff's `rounding` and a multiplier's `reducedBy`; 5 adds the
 * `logarithmic` tariff and a tariff's `minimum`; 6 adds the model's `limits`.
 * A model says
 * which version it needs, so an evaluator that predates a feature refuses the
 * model instead of ignoring it.
 */
export const TAX_MODEL_SCHEMA_VERSION = 6;
const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [1, 2, 3, 4, 5, 6];

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
  /**
   * A share by which the tariff amount is reduced before this multiplier
   * applies, and only for it (0.05: the multiplier applies to 95% of it): a
   * canton that cuts its own share of a basic tax its communes also levy.
   * In [0, 1). Optional: missing, nothing is reduced. Needs `schemaVersion` 4.
   */
  reducedBy?: ReductionRef;
}

export interface DivisorRef extends FactRef {
  /** When the fact is missing, divide by 1 instead of making the estimate incomplete. */
  optional?: boolean;
}

export interface ReductionRef extends FactRef {
  /** When the fact is missing, reduce nothing instead of making the estimate incomplete. */
  optional?: boolean;
}

export interface LimitRef extends FactRef {
  /** When the fact is missing, limit nothing instead of making the estimate incomplete. */
  optional?: boolean;
}

/**
 * The listed components together may not exceed a share of the base (a
 * fact, in (0, 1]); above it, each is reduced in proportion to its amount.
 * Needs `schemaVersion` 6.
 */
export interface ShareLimit {
  components: readonly string[];
  share: LimitRef;
}

export interface TaxComponent {
  /** Unique within the model; the result reports each component under it. */
  key: string;
  tariff: FactRef;
  /**
   * The tariff is applied to the base divided by this fact, and the tariff
   * amount multiplied by it again: a couple's income split in two (2), or a
   * family quotient. Read per variant, so one tariff serves a single person
   * (1) and a couple. At least 1. Needs `schemaVersion` 2.
   */
  divisor?: DivisorRef;
  /**
   * Summed, then applied to the tariff amount. Absent: the tariff amount is
   * the tax.
   */
  multipliers?: readonly MultiplierRef[];
  /** A boolean input that must be true for this component to apply at all. */
  when?: string;
}

export interface TaxModel {
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6;
  /** The input the tariffs are applied to. Must be listed in `inputs`. */
  base: string;
  /** Every input the model reads: the base amount and any boolean conditions. */
  inputs: readonly string[];
  /** Which tariff variant applies (for example by household). At least one. */
  variants: readonly string[];
  components: readonly TaxComponent[];
  limits?: readonly ShareLimit[];
}

export interface Bracket {
  /** The amount from which this marginal rate applies. */
  from: number;
  /** Marginal rate as a fraction (0.02 = 2%). */
  rate: number;
}

/** A step of a `stepped` tariff. */
export interface Step {
  /** The amount at which this step starts. */
  from: number;
  /** The tax at `from`, as the tariff states it. */
  base: number;
  /** Marginal rate on the excess over `from`, as a fraction. */
  rate: number;
}

/** A point of an `average` tariff. */
export interface RatePoint {
  /** The amount at which the average rate is `rate`. */
  from: number;
  /** Average rate on the whole amount, as a fraction. */
  rate: number;
}

/**
 * A piece of a `logarithmic` tariff: from `from` on, the amount at x is
 * constant + linear·x + xLnX·x·ln(x).
 */
export interface Piece {
  from: number;
  constant: number;
  linear: number;
  xLnX: number;
}

/**
 * How a tariff rounds what it reads, each amount down to a multiple of its
 * step. `base`: the amount taxed. `divided`: where a component divides the
 * base, the divided amount, whose rate then applies to the whole (rounded)
 * base. Needs `schemaVersion` 4.
 */
export interface Rounding {
  base: number;
  divided?: number;
}

interface TariffBase {
  /** ISO 4217. Every tariff one estimate reads must share it. */
  currency: string;
  /** Upper bound on the tariff amount, in `currency`. */
  cap?: number;
  rounding?: Rounding;
  /**
   * A tariff amount below this is not levied (0), after any divisor is
   * multiplied back. Needs `schemaVersion` 5.
   */
  minimum?: number;
}

/**
 * `progressive`: marginal rates summed bracket by bracket. `flat`: one rate.
 * `stepped`: the tax a step states at its start plus its rate on the excess;
 * where the stated amounts and the rates below them disagree, the stated
 * amounts hold (needs `schemaVersion` 3). `average`: an average rate on the
 * whole amount, interpolated linearly between points and held beyond the last
 * (needs `schemaVersion` 3). `logarithmic`: the formula of the last piece
 * begun, 0 before the first (needs `schemaVersion` 5).
 */
export type Tariff =
  | (TariffBase & { kind: 'progressive'; brackets: readonly Bracket[] })
  | (TariffBase & { kind: 'flat'; rate: number })
  | (TariffBase & { kind: 'stepped'; steps: readonly Step[] })
  | (TariffBase & { kind: 'average'; points: readonly RatePoint[] })
  | (TariffBase & { kind: 'logarithmic'; pieces: readonly Piece[] });

/** The schema version a model needs for its facts to carry this tariff. */
export function tariffSchemaVersion(tariff: Tariff): number {
  if (tariff.kind === 'logarithmic' || tariff.minimum !== undefined) {
    return 5;
  }
  if (tariff.rounding !== undefined) {
    return 4;
  }
  return tariff.kind === 'stepped' || tariff.kind === 'average' ? 3 : 1;
}

/** One number for one period. At most one fact per (level, metric, variant). */
export interface Fact {
  level: string;
  metric: string;
  /** Absent: the fact applies to every variant. */
  variant?: string;
  /**
   * A tariff for a component's `tariff`, a fraction (1.19 = 119%) for a
   * multiplier, a number of at least 1 for a divisor.
   */
  value: Tariff | number;
}

/** Every fact a component reads: its tariff, its divisor, then its multipliers and their reductions. */
export function componentRefs(component: TaxComponent): FactRef[] {
  return [
    component.tariff,
    ...(component.divisor ? [component.divisor] : []),
    ...(component.multipliers ?? []).flatMap(m => (m.reducedBy ? [m, m.reducedBy] : [m])),
  ];
}

/** Every fact a model reads: each component's, then each limit's share. */
export function modelRefs(model: TaxModel): FactRef[] {
  return [
    ...model.components.flatMap(componentRefs),
    ...(model.limits ?? []).map(limit => limit.share),
  ];
}

/** Why a model cannot be evaluated, one line per problem; empty when it can. */
export function modelProblems(model: TaxModel): string[] {
  const problems: string[] = [];
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(model.schemaVersion)) {
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
    if (component.divisor !== undefined && model.schemaVersion < 2) {
      problems.push(`component "${component.key}" has a divisor, which needs schemaVersion 2`);
    }
    if (component.multipliers?.some(m => m.reducedBy !== undefined) && model.schemaVersion < 4) {
      problems.push(
        `component "${component.key}" has a reduced multiplier, which needs schemaVersion 4`
      );
    }
    const conditions = [component.when, ...(component.multipliers ?? []).map(m => m.when)];
    for (const condition of conditions) {
      if (condition !== undefined && !model.inputs.includes(condition)) {
        problems.push(`component "${component.key}" reads undeclared input "${condition}"`);
      }
    }
  }
  if (model.limits !== undefined && model.schemaVersion < 6) {
    problems.push('limits need schemaVersion 6');
  }
  for (const limit of model.limits ?? []) {
    if (limit.components.length === 0) {
      problems.push(`the limit on ${limit.share.metric} names no component`);
    }
    for (const key of limit.components) {
      if (!seen.has(key)) {
        problems.push(`the limit on ${limit.share.metric} names unknown component "${key}"`);
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
  if (tariff.minimum !== undefined && !(tariff.minimum >= 0)) {
    return 'minimum is negative';
  }
  if (tariff.rounding !== undefined) {
    const { base, divided } = tariff.rounding;
    if (!(base > 0) || (divided !== undefined && !(divided > 0))) {
      return 'a rounding step is not positive';
    }
  }
  switch (tariff.kind) {
    case 'flat':
      return isRate(tariff.rate) ? null : `rate ${tariff.rate} is outside [0, 1]`;
    case 'progressive':
      return rowsProblem('bracket', tariff.brackets);
    case 'stepped': {
      const negative = tariff.steps.findIndex(step => !(step.base >= 0));
      return negative >= 0
        ? `step ${negative} states a negative tax`
        : rowsProblem('step', tariff.steps);
    }
    case 'average':
      return rowsProblem('point', tariff.points);
    case 'logarithmic':
      return piecesProblem(tariff.pieces);
    default:
      return `tariff kind "${(tariff as { kind: unknown }).kind}" is not known`;
  }
}

/** Rows that each start at `from` with a rate: non-empty, rates in [0, 1], rising from zero. */
function rowsProblem(name: string, rows: readonly { from: number; rate: number }[]): string | null {
  if (rows.length === 0) {
    return `${name}s is empty`;
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (!isRate(row.rate)) {
      return `${name} ${i} rate ${row.rate} is outside [0, 1]`;
    }
    if (!(row.from >= 0)) {
      return `${name} ${i} starts below zero`;
    }
    if (i > 0 && !(row.from > rows[i - 1]!.from)) {
      return `${name} ${i} does not start above ${name} ${i - 1}`;
    }
  }
  return null;
}

/** Pieces: non-empty, finite coefficients, rising from zero. */
function piecesProblem(pieces: readonly Piece[]): string | null {
  if (pieces.length === 0) {
    return 'pieces is empty';
  }
  for (let i = 0; i < pieces.length; i++) {
    const { from, constant, linear, xLnX } = pieces[i]!;
    if (![constant, linear, xLnX].every(Number.isFinite)) {
      return `piece ${i} has a coefficient that is not a finite number`;
    }
    if (!(from >= 0)) {
      return `piece ${i} starts below zero`;
    }
    if (i > 0 && !(from > pieces[i - 1]!.from)) {
      return `piece ${i} does not start above piece ${i - 1}`;
    }
  }
  return null;
}

function isRate(rate: number): boolean {
  return rate >= 0 && rate <= 1;
}
