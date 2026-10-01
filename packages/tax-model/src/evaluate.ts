/**
 * The evaluator: a pure function from a model, the period's facts and a
 * person's inputs to an estimate. No I/O and no clock, so it runs in the
 * browser and the income never leaves the device.
 */
import {
  componentRefs,
  tariffProblem,
  tariffSchemaVersion,
  type Fact,
  type FactRef,
  type Tariff,
  type TaxModel,
} from './model';

export interface EvaluateInput {
  /** The model's inputs: a number for `base`, booleans for conditions. */
  values: Readonly<Record<string, number | boolean>>;
  /** One of the model's variants. */
  variant: string;
}

export interface ComponentResult {
  key: string;
  /** False when the component's condition is not met; its amount is then 0. */
  applies: boolean;
  /** The tariff applied to the base, before multipliers. Null when the tariff is missing. */
  tariffAmount: number | null;
  /** The divisor the tariff was applied with. Null when the component has none or it is missing. */
  divisor: number | null;
  /** The sum of the multipliers that count. Null when the component has none. */
  multiplier: number | null;
  /** Null when a required fact is missing. */
  amount: number | null;
  missing: readonly FactRef[];
}

export interface Estimate {
  components: readonly ComponentResult[];
  /** Sum of the components that could be computed. Unrounded: rounding is presentation. */
  total: number;
  /** total / base, 0 when the base is 0. */
  effectiveRate: number;
  /** Null only when no tariff was found at all. */
  currency: string | null;
  /** False when any required fact is missing; `total` is then a lower bound. */
  complete: boolean;
  missing: readonly FactRef[];
}

/** The tariff amount for a base, rounded as the tariff says, capped, and 0 below its minimum. */
export function applyTariff(base: number, tariff: Tariff): number {
  return levied(amountAt(roundDown(base, tariff.rounding?.base), tariff), tariff);
}

/**
 * The tariff amount for a base divided by `divisor`, multiplied back. Where
 * the tariff rounds the divided amount, the rate at the rounded amount applies
 * to the whole (rounded) base.
 */
function dividedAmount(base: number, divisor: number, tariff: Tariff): number {
  const rounded = roundDown(base, tariff.rounding?.base);
  const exact = rounded / divisor;
  const divided = roundDown(exact, tariff.rounding?.divided);
  if (divided === exact) {
    return levied(divisor * amountAt(exact, tariff), tariff);
  }
  return levied(divided > 0 ? (rounded * amountAt(divided, tariff)) / divided : 0, tariff);
}

const levied = (amount: number, tariff: Tariff): number =>
  tariff.minimum !== undefined && amount < tariff.minimum ? 0 : amount;

const roundDown = (amount: number, step: number | undefined): number =>
  step === undefined ? amount : Math.floor(amount / step) * step;

function amountAt(base: number, tariff: Tariff): number {
  if (!(base > 0)) {
    return 0;
  }
  const amount = uncapped(base, tariff);
  return tariff.cap === undefined ? amount : Math.min(amount, tariff.cap);
}

function uncapped(base: number, tariff: Tariff): number {
  switch (tariff.kind) {
    case 'flat':
      return base * tariff.rate;
    case 'progressive': {
      const brackets = tariff.brackets;
      let amount = 0;
      for (let i = 0; i < brackets.length; i++) {
        const floor = brackets[i]!.from;
        if (base <= floor) {
          break;
        }
        const ceiling = i + 1 < brackets.length ? brackets[i + 1]!.from : Infinity;
        amount += (Math.min(base, ceiling) - floor) * brackets[i]!.rate;
      }
      return amount;
    }
    case 'stepped': {
      const reached = tariff.steps.filter(s => s.from <= base);
      const step = reached[reached.length - 1];
      return step === undefined ? 0 : step.base + (base - step.from) * step.rate;
    }
    case 'average': {
      const points = tariff.points;
      const next = points.findIndex(p => p.from > base);
      if (next === 0) {
        return 0;
      }
      if (next === -1) {
        return base * points[points.length - 1]!.rate;
      }
      const a = points[next - 1]!;
      const b = points[next]!;
      return base * (a.rate + ((base - a.from) / (b.from - a.from)) * (b.rate - a.rate));
    }
    case 'logarithmic': {
      const begun = tariff.pieces.filter(p => p.from <= base);
      const piece = begun[begun.length - 1];
      return piece === undefined
        ? 0
        : piece.constant + piece.linear * base + piece.xLnX * base * Math.log(base);
    }
    default:
      throw new Error(`tariff kind "${(tariff as { kind: unknown }).kind}" is not known`);
  }
}

export function evaluate(model: TaxModel, facts: readonly Fact[], input: EvaluateInput): Estimate {
  if (!model.variants.includes(input.variant)) {
    throw new Error(`variant "${input.variant}" is not one of the model's variants`);
  }
  const rawBase = input.values[model.base];
  if (rawBase !== undefined && typeof rawBase !== 'number') {
    throw new Error(`input "${model.base}" must be a number`);
  }
  const base = rawBase !== undefined && rawBase > 0 ? rawBase : 0;
  const lookup = factLookup(facts, input.variant);
  const isTrue = (condition: string | undefined) =>
    condition === undefined || input.values[condition] === true;

  let currency: string | null = null;
  const components: ComponentResult[] = model.components.map(component => {
    if (!isTrue(component.when)) {
      return {
        key: component.key,
        applies: false,
        tariffAmount: 0,
        divisor: null,
        multiplier: null,
        amount: 0,
        missing: [],
      };
    }
    const missing: FactRef[] = [];
    let divisor: number | null = null;
    if (component.divisor !== undefined) {
      const value = lookup(component.divisor);
      if (value === undefined) {
        if (component.divisor.optional) {
          divisor = 1;
        } else {
          missing.push(ref(component.divisor));
        }
      } else if (typeof value !== 'number') {
        throw new Error(`${describe(component.divisor)} is a tariff where a divisor was expected`);
      } else if (!(value >= 1) || !Number.isFinite(value)) {
        throw new Error(`${describe(component.divisor)}: divisor ${value} is below 1`);
      } else {
        divisor = value;
      }
    }
    const tariff = lookup(component.tariff);
    let tariffAmount: number | null = null;
    if (tariff === undefined) {
      missing.push(ref(component.tariff));
    } else if (typeof tariff === 'number') {
      throw new Error(`${describe(component.tariff)} is a number where a tariff was expected`);
    } else {
      const problem = tariffProblem(tariff);
      if (problem !== null) {
        throw new Error(`${describe(component.tariff)}: ${problem}`);
      }
      if (tariffSchemaVersion(tariff) > model.schemaVersion) {
        throw new Error(
          `${describe(component.tariff)}: a ${tariff.kind} tariff needs schemaVersion ${tariffSchemaVersion(tariff)}`
        );
      }
      if (currency !== null && tariff.currency !== currency) {
        throw new Error(`tariffs in ${currency} and ${tariff.currency} cannot be combined`);
      }
      currency = tariff.currency;
      tariffAmount =
        divisor === null ? applyTariff(base, tariff) : dividedAmount(base, divisor, tariff);
    }

    let multiplier: number | null = null;
    if (component.multipliers !== undefined) {
      multiplier = 0;
      for (const m of component.multipliers) {
        if (!isTrue(m.when)) {
          continue;
        }
        const value = lookup(m);
        if (value === undefined) {
          if (!m.optional) {
            missing.push(ref(m));
          }
          continue;
        }
        if (typeof value !== 'number') {
          throw new Error(`${describe(m)} is a tariff where a multiplier was expected`);
        }
        let reduction = 0;
        if (m.reducedBy !== undefined) {
          const share = lookup(m.reducedBy);
          if (share === undefined) {
            if (!m.reducedBy.optional) {
              missing.push(ref(m.reducedBy));
            }
          } else if (typeof share !== 'number' || !(share >= 0 && share < 1)) {
            throw new Error(`${describe(m.reducedBy)}: a reduction must be a share in [0, 1)`);
          } else {
            reduction = share;
          }
        }
        multiplier += value * (1 - reduction);
      }
    }

    const amount =
      missing.length > 0 || tariffAmount === null
        ? null
        : multiplier === null
          ? tariffAmount
          : tariffAmount * multiplier;
    return {
      key: component.key,
      applies: true,
      tariffAmount,
      divisor,
      multiplier,
      amount,
      missing,
    };
  });

  const total = components.reduce((sum, c) => sum + (c.amount ?? 0), 0);
  const missing = components.flatMap(c => c.missing);
  return {
    components,
    total,
    effectiveRate: base > 0 ? total / base : 0,
    currency,
    complete: missing.length === 0,
    missing,
  };
}

/** The distinct levels a model reads from, in the order it names them. */
export function referencedLevels(model: TaxModel): string[] {
  const levels: string[] = [];
  for (const component of model.components) {
    for (const r of componentRefs(component)) {
      if (!levels.includes(r.level)) {
        levels.push(r.level);
      }
    }
  }
  return levels;
}

/**
 * The levels that take tax in these facts: the model reads from them and they
 * publish a fact it reads. A level the model never names takes no tax, however
 * many facts it has — which is why a city quarter takes none while its city does.
 */
export function taxingLevels(model: TaxModel, facts: readonly Fact[]): string[] {
  return referencedLevels(model).filter(level =>
    model.components.some(component =>
      [component.tariff, ...(component.multipliers ?? [])].some(
        r => r.level === level && facts.some(f => f.level === level && f.metric === r.metric)
      )
    )
  );
}

function factLookup(facts: readonly Fact[], variant: string) {
  const exact = new Map<string, Fact['value']>();
  const general = new Map<string, Fact['value']>();
  for (const fact of facts) {
    if (fact.variant !== undefined && fact.variant !== variant) {
      continue;
    }
    const target = fact.variant === undefined ? general : exact;
    const key = keyOf(fact);
    if (target.has(key)) {
      throw new Error(`${describe(fact)} is given twice for variant "${variant}"`);
    }
    target.set(key, fact.value);
  }
  return (r: FactRef) => exact.get(keyOf(r)) ?? general.get(keyOf(r));
}

function keyOf(r: FactRef): string {
  return `${r.level}\u0000${r.metric}`;
}

function ref(r: FactRef): FactRef {
  return { level: r.level, metric: r.metric };
}

function describe(r: FactRef): string {
  return `fact ${r.level}/${r.metric}`;
}
