import { describe, expect, it } from 'vitest';
import {
  applyTariff,
  componentRefs,
  evaluate,
  modelProblems,
  referencedLevels,
  tariffProblem,
  tariffSchemaVersion,
  taxingLevels,
  type Fact,
  type Tariff,
  type TaxModel,
} from '@bitbaum/tax-model';
import { ZURICH_CITY_SINGLE_2025 } from '@/config/tax-estimates';
import { estimateIncomeTax } from '@/domain/finances/tax';

/**
 * A made-up country, so nothing here can pass by knowing a real one: a realm
 * taxes on its own tariff, and a basic tariff is multiplied by the realm's and
 * the shire's multipliers, plus the temple's for members.
 */
const MODEL: TaxModel = {
  schemaVersion: 1,
  base: 'income',
  inputs: ['income', 'temple_member'],
  variants: ['alone', 'together'],
  components: [
    { key: 'realm', tariff: { level: 'realm', metric: 'tariff' } },
    {
      key: 'local',
      tariff: { level: 'realm', metric: 'tariff.basic' },
      multipliers: [
        { level: 'realm', metric: 'multiplier' },
        { level: 'shire', metric: 'multiplier' },
        { level: 'guild', metric: 'multiplier', optional: true },
        { level: 'temple', metric: 'multiplier', when: 'temple_member' },
      ],
    },
  ],
};

const progressive = (brackets: [number, number][], cap?: number): Tariff => ({
  kind: 'progressive',
  currency: 'XTS',
  brackets: brackets.map(([from, rate]) => ({ from, rate })),
  ...(cap === undefined ? {} : { cap }),
});

const FACTS: Fact[] = [
  {
    level: 'realm',
    metric: 'tariff',
    value: progressive([
      [0, 0],
      [10_000, 0.1],
      [50_000, 0.2],
    ]),
  },
  { level: 'realm', metric: 'tariff.basic', value: progressive([[0, 0.05]]) },
  { level: 'realm', metric: 'multiplier', value: 0.8 },
  { level: 'shire', metric: 'multiplier', value: 1.2 },
  { level: 'temple', metric: 'multiplier', value: 0.1 },
  { level: 'quarter', metric: 'population', value: 5_000 },
];

const run = (income: number, extra: Record<string, boolean> = {}, facts = FACTS) =>
  evaluate(MODEL, facts, { values: { income, ...extra }, variant: 'alone' });

describe('applyTariff', () => {
  it('sums marginal layers', () => {
    // 40k at 10% + 10k at 20%
    expect(
      applyTariff(
        60_000,
        progressive([
          [0, 0],
          [10_000, 0.1],
          [50_000, 0.2],
        ])
      )
    ).toBeCloseTo(6_000);
  });

  it('applies a flat rate and a cap', () => {
    expect(applyTariff(1_000, { kind: 'flat', currency: 'XTS', rate: 0.3 })).toBeCloseTo(300);
    expect(applyTariff(1_000, { kind: 'flat', currency: 'XTS', rate: 0.3, cap: 100 })).toBe(100);
  });

  it('takes nothing from no income', () => {
    expect(applyTariff(0, progressive([[0, 0.5]]))).toBe(0);
    expect(applyTariff(-5, progressive([[0, 0.5]]))).toBe(0);
  });
});

describe('evaluate', () => {
  it('multiplies a basic tariff by the sum of the multipliers that count', () => {
    const estimate = run(60_000);
    const local = estimate.components.find(c => c.key === 'local')!;
    expect(local.tariffAmount).toBeCloseTo(3_000);
    expect(local.multiplier).toBeCloseTo(2.0);
    expect(local.amount).toBeCloseTo(6_000);
    expect(estimate.total).toBeCloseTo(12_000);
    expect(estimate.effectiveRate).toBeCloseTo(0.2);
    expect(estimate.currency).toBe('XTS');
    expect(estimate.complete).toBe(true);
  });

  it('counts a conditional multiplier only when its input is true', () => {
    const member = run(60_000, { temple_member: true });
    expect(member.components.find(c => c.key === 'local')!.multiplier).toBeCloseTo(2.1);
  });

  it('skips a component whose condition is false', () => {
    const model: TaxModel = {
      ...MODEL,
      components: [{ ...MODEL.components[0]!, when: 'temple_member' }],
    };
    const estimate = evaluate(model, FACTS, { values: { income: 60_000 }, variant: 'alone' });
    expect(estimate.components[0]).toMatchObject({ applies: false, amount: 0 });
    expect(estimate.total).toBe(0);
  });

  it('reports a missing required fact instead of guessing, and keeps what it could compute', () => {
    const estimate = run(
      60_000,
      {},
      FACTS.filter(f => f.level !== 'shire')
    );
    expect(estimate.complete).toBe(false);
    expect(estimate.missing).toEqual([{ level: 'shire', metric: 'multiplier' }]);
    expect(estimate.components.find(c => c.key === 'local')!.amount).toBeNull();
    expect(estimate.total).toBeCloseTo(6_000);
  });

  it('treats a missing optional multiplier as zero', () => {
    expect(run(60_000).missing).toEqual([]);
  });

  it('prefers a fact for the variant over a general one', () => {
    const facts: Fact[] = [
      ...FACTS,
      { level: 'shire', metric: 'multiplier', variant: 'alone', value: 2.2 },
    ];
    expect(run(60_000, {}, facts).components.find(c => c.key === 'local')!.multiplier).toBeCloseTo(
      3.0
    );
  });

  it('refuses what it cannot answer honestly', () => {
    expect(() => evaluate(MODEL, FACTS, { values: { income: 1 }, variant: 'nobody' })).toThrow(
      /variant/
    );
    const mixed: Fact[] = FACTS.map(f =>
      f.metric === 'tariff.basic' ? { ...f, value: { ...(f.value as Tariff), currency: 'XXX' } } : f
    );
    expect(() => run(60_000, {}, mixed)).toThrow(/cannot be combined/);
    expect(() => run(60_000, {}, [...FACTS, FACTS[2]!])).toThrow(/twice/);
    const unsorted: Fact[] = FACTS.map(f =>
      f.metric === 'tariff'
        ? {
            ...f,
            value: progressive([
              [10_000, 0.1],
              [0, 0],
            ]),
          }
        : f
    );
    expect(() => run(60_000, {}, unsorted)).toThrow(/does not start above/);
  });
});

describe('divisor', () => {
  /** The local tariff is split for couples: applied to half the income, then doubled. */
  const SPLIT: TaxModel = {
    ...MODEL,
    schemaVersion: 2,
    components: [
      MODEL.components[0]!,
      { ...MODEL.components[1]!, divisor: { level: 'realm', metric: 'divisor' } },
    ],
  };
  const LOCAL_TARIFF: Fact = {
    level: 'realm',
    metric: 'tariff.basic',
    value: progressive([
      [0, 0],
      [20_000, 0.1],
    ]),
  };
  const facts = (...divisors: Fact[]) => [
    ...FACTS.filter(f => f.metric !== 'tariff.basic'),
    LOCAL_TARIFF,
    ...divisors,
  ];
  const local = (estimate: ReturnType<typeof evaluate>) =>
    estimate.components.find(c => c.key === 'local')!;

  it('applies the tariff to the divided base and multiplies the amount back', () => {
    const f = facts(
      { level: 'realm', metric: 'divisor', variant: 'alone', value: 1 },
      { level: 'realm', metric: 'divisor', variant: 'together', value: 2 }
    );
    const alone = evaluate(SPLIT, f, { values: { income: 60_000 }, variant: 'alone' });
    const together = evaluate(SPLIT, f, { values: { income: 60_000 }, variant: 'together' });
    // Alone: 40k over the threshold at 10%. Together: 2 × (10k over it at 10%).
    expect(local(alone)).toMatchObject({ tariffAmount: 4_000, divisor: 1 });
    expect(local(together)).toMatchObject({ tariffAmount: 2_000, divisor: 2 });
    expect(local(together).amount).toBeCloseTo(4_000);
  });

  it('makes the estimate incomplete when a required divisor is missing, and divides by 1 when optional', () => {
    const missing = evaluate(SPLIT, facts(), { values: { income: 60_000 }, variant: 'together' });
    expect(missing.complete).toBe(false);
    expect(missing.missing).toEqual([{ level: 'realm', metric: 'divisor' }]);
    expect(local(missing).amount).toBeNull();

    const optional: TaxModel = {
      ...SPLIT,
      components: [
        SPLIT.components[0]!,
        { ...SPLIT.components[1]!, divisor: { level: 'realm', metric: 'divisor', optional: true } },
      ],
    };
    const estimate = evaluate(optional, facts(), {
      values: { income: 60_000 },
      variant: 'together',
    });
    expect(local(estimate)).toMatchObject({ tariffAmount: 4_000, divisor: 1 });
  });

  it('refuses a divisor below 1 or a tariff in its place', () => {
    const below = facts({ level: 'realm', metric: 'divisor', value: 0.5 });
    expect(() => evaluate(SPLIT, below, { values: { income: 1 }, variant: 'alone' })).toThrow(
      /below 1/
    );
    const tariff = facts({ level: 'realm', metric: 'divisor', value: progressive([[0, 0.1]]) });
    expect(() => evaluate(SPLIT, tariff, { values: { income: 1 }, variant: 'alone' })).toThrow(
      /where a divisor was expected/
    );
  });

  it('needs schemaVersion 2, and counts as a level the model reads', () => {
    expect(modelProblems(SPLIT)).toEqual([]);
    expect(modelProblems({ ...SPLIT, schemaVersion: 1 })).toEqual([
      'component "local" has a divisor, which needs schemaVersion 2',
    ]);
    expect(modelProblems({ ...SPLIT, schemaVersion: 6 as 5 })).toEqual([
      'schemaVersion 6 is not supported',
    ]);
    expect(referencedLevels(SPLIT)).toEqual(['realm', 'shire', 'guild', 'temple']);
  });

  it('is among the facts a component reads, between its tariff and its multipliers', () => {
    expect(componentRefs(SPLIT.components[1]!).map(r => r.metric)).toEqual([
      'tariff.basic',
      'divisor',
      ...SPLIT.components[1]!.multipliers!.map(m => m.metric),
    ]);
  });
});

describe('stepped and average tariffs', () => {
  /** States 20 at 1,000 where the rate below it would give 1: the stated amount holds. */
  const STEPPED: Tariff = {
    kind: 'stepped',
    currency: 'XTS',
    steps: [
      { from: 0, base: 0, rate: 0.001 },
      { from: 1_000, base: 20, rate: 0.05 },
      { from: 5_000, base: 220, rate: 0.1 },
    ],
  };
  /** 2% at 10,000 rising to 6% at 30,000, then held. */
  const AVERAGE: Tariff = {
    kind: 'average',
    currency: 'XTS',
    points: [
      { from: 10_000, rate: 0.02 },
      { from: 30_000, rate: 0.06 },
    ],
  };

  it('adds the rate on the excess to the tax a step states', () => {
    expect(applyTariff(500, STEPPED)).toBeCloseTo(0.5);
    expect(applyTariff(1_000, STEPPED)).toBeCloseTo(20);
    expect(applyTariff(3_000, STEPPED)).toBeCloseTo(120);
    expect(applyTariff(10_000, STEPPED)).toBeCloseTo(720);
  });

  it('applies an interpolated average rate to the whole amount, and holds it beyond the last point', () => {
    expect(applyTariff(5_000, AVERAGE)).toBe(0);
    expect(applyTariff(10_000, AVERAGE)).toBeCloseTo(200);
    expect(applyTariff(20_000, AVERAGE)).toBeCloseTo(800);
    expect(applyTariff(100_000, AVERAGE)).toBeCloseTo(6_000);
  });

  it('needs schemaVersion 3, so an older model cannot read one by mistake', () => {
    const facts = [
      ...FACTS.filter(f => f.metric !== 'tariff'),
      { level: 'realm', metric: 'tariff', value: STEPPED },
    ];
    expect(() => run(3_000, {}, facts)).toThrow(/a stepped tariff needs schemaVersion 3/);
    const estimate = evaluate({ ...MODEL, schemaVersion: 3 }, facts, {
      values: { income: 3_000 },
      variant: 'alone',
    });
    expect(estimate.components[0]!.amount).toBeCloseTo(120);
  });

  it('rejects a negative stated tax, unsorted steps and an empty table', () => {
    expect(
      tariffProblem({ ...STEPPED, steps: [{ from: 0, base: -1, rate: 0.1 }] } as Tariff)
    ).toMatch(/negative tax/);
    expect(
      tariffProblem({
        ...AVERAGE,
        points: [
          { from: 10, rate: 0.1 },
          { from: 5, rate: 0.2 },
        ],
      } as Tariff)
    ).toMatch(/point 1 does not start above point 0/);
    expect(tariffProblem({ kind: 'average', currency: 'XTS', points: [] })).toBe('points is empty');
    expect(tariffProblem({ kind: 'mystery', currency: 'XTS' } as unknown as Tariff)).toMatch(
      /not known/
    );
  });
});

describe('logarithmic tariffs and minimum amounts', () => {
  // Basel-Landschaft 2025: −0.827429·x + 0.089718·x·(ln x − 1) + 829.41877 from CHF 16,716.
  const PIECES = [
    { from: 0, constant: 0, linear: 0, xLnX: 0 },
    { from: 16_716, constant: 829.41877, linear: -0.827429 - 0.089718, xLnX: 0.089718 },
  ];
  const LOG: Tariff = { kind: 'logarithmic', currency: 'CHF', pieces: PIECES };

  it('applies the formula of the last piece begun, and nothing before it', () => {
    const x = 30_000;
    expect(applyTariff(x, LOG)).toBeCloseTo(
      -0.827429 * x + 0.089718 * x * (Math.log(x) - 1) + 829.41877
    );
    expect(applyTariff(16_715, LOG)).toBe(0);
    // Where the piece starts, it meets the 0.49% the couple's table gives below it.
    expect(applyTariff(16_716, LOG)).toBeCloseTo(16_716 * 0.0049, 0);
  });

  it('levies nothing below the minimum, after the divisor is multiplied back', () => {
    const tariff: Tariff = { ...progressive([[0, 0.01]]), minimum: 25 };
    expect(applyTariff(2_400, tariff)).toBe(0);
    expect(applyTariff(2_500, tariff)).toBeCloseTo(25);
    const model: TaxModel = {
      ...MODEL,
      schemaVersion: 5,
      components: [
        {
          key: 'split',
          tariff: { level: 'realm', metric: 't' },
          divisor: { level: 'realm', metric: 'd' },
        },
      ],
    };
    const facts: Fact[] = [
      { level: 'realm', metric: 't', value: tariff },
      { level: 'realm', metric: 'd', value: 2 },
    ];
    // 4,000 ÷ 2 = 2,000: 20 a half, but 40 multiplied back is levied.
    const together = evaluate(model, facts, { values: { income: 4_000 }, variant: 'alone' });
    expect(together.total).toBeCloseTo(40);
  });

  it('needs schemaVersion 5', () => {
    expect(tariffSchemaVersion(LOG)).toBe(5);
    expect(tariffSchemaVersion({ ...progressive([[0, 0.01]]), minimum: 25 })).toBe(5);
    expect(tariffProblem(LOG)).toBeNull();
    expect(tariffProblem({ ...LOG, pieces: [PIECES[1]!, PIECES[0]!] })).toMatch(
      /does not start above/
    );
    expect(tariffProblem({ ...LOG, minimum: -1 })).toBe('minimum is negative');
    const facts = [
      ...FACTS.filter(f => f.metric !== 'tariff'),
      { level: 'realm', metric: 'tariff', value: LOG },
    ];
    expect(() => run(30_000, {}, facts)).toThrow(/needs schemaVersion 5/);
  });
});

describe('rounding and reductions', () => {
  /** 10% from 0, rounding the base down to 100. */
  const ROUNDED: Tariff = { ...progressive([[0, 0.1]]), rounding: { base: 100 } };
  /** 0 up to 10,000, then 10%: the divided amount decides the rate. */
  const SPLIT_TARIFF: Tariff = {
    ...progressive([
      [0, 0],
      [10_000, 0.1],
    ]),
    rounding: { base: 100, divided: 100 },
  };
  const V4: TaxModel = {
    ...MODEL,
    schemaVersion: 4,
    components: [
      MODEL.components[0]!,
      {
        ...MODEL.components[1]!,
        divisor: { level: 'realm', metric: 'divisor', optional: true },
        multipliers: [
          {
            level: 'realm',
            metric: 'multiplier',
            reducedBy: { level: 'realm', metric: 'reduction', optional: true },
          },
          { level: 'shire', metric: 'multiplier' },
        ],
      },
    ],
  };
  const local = (estimate: ReturnType<typeof evaluate>) =>
    estimate.components.find(c => c.key === 'local')!;

  it('rounds the base down before the tariff applies', () => {
    expect(applyTariff(1_299, ROUNDED)).toBeCloseTo(120);
  });

  it('applies the rate at the rounded divided amount to the whole rounded base', () => {
    const facts: Fact[] = [
      ...FACTS.filter(f => f.metric !== 'tariff.basic'),
      { level: 'realm', metric: 'tariff.basic', value: SPLIT_TARIFF },
      { level: 'realm', metric: 'divisor', variant: 'together', value: 1.8 },
    ];
    // 37,777 → 37,700; ÷ 1.8 = 20,944.4 → 20,900, where the average rate is
    // 1,090 / 20,900; applied to 37,700.
    const together = evaluate(V4, facts, { values: { income: 37_777 }, variant: 'together' });
    expect(local(together).tariffAmount).toBeCloseTo((37_700 * 1_090) / 20_900);
    // Without a divided step, the divided amount is not rounded.
    const unrounded = facts.map(f =>
      f.metric === 'tariff.basic'
        ? { ...f, value: { ...SPLIT_TARIFF, rounding: { base: 100 } } }
        : f
    );
    const plain = evaluate(V4, unrounded, { values: { income: 37_777 }, variant: 'together' });
    expect(local(plain).tariffAmount).toBeCloseTo(1.8 * (37_700 / 1.8 - 10_000) * 0.1);
  });

  it('reduces only the multiplier it is attached to, and nothing when the share is missing', () => {
    const reduced = [...FACTS, { level: 'realm', metric: 'reduction', value: 0.05 }];
    const estimate = evaluate(V4, reduced, { values: { income: 10_000 }, variant: 'alone' });
    expect(local(estimate).multiplier).toBeCloseTo(0.8 * 0.95 + 1.2);
    const none = evaluate(V4, FACTS, { values: { income: 10_000 }, variant: 'alone' });
    expect(local(none).multiplier).toBeCloseTo(2);
    const wrong = [...FACTS, { level: 'realm', metric: 'reduction', value: 1 }];
    expect(() => evaluate(V4, wrong, { values: { income: 1 }, variant: 'alone' })).toThrow(
      /share in \[0, 1\)/
    );
  });

  it('needs schemaVersion 4, and counts the reduction among the facts a component reads', () => {
    expect(modelProblems(V4)).toEqual([]);
    expect(modelProblems({ ...V4, schemaVersion: 3 })).toEqual([
      'component "local" has a reduced multiplier, which needs schemaVersion 4',
    ]);
    const rounded = [
      ...FACTS.filter(f => f.metric !== 'tariff'),
      { level: 'realm', metric: 'tariff', value: ROUNDED },
    ];
    expect(() => run(1_000, {}, rounded)).toThrow(/needs schemaVersion 4/);
    expect(componentRefs(V4.components[1]!).map(r => r.metric)).toEqual([
      'tariff.basic',
      'divisor',
      'multiplier',
      'reduction',
      'multiplier',
    ]);
    expect(tariffProblem({ ...ROUNDED, rounding: { base: 0 } })).toMatch(/not positive/);
  });
});

describe('levels', () => {
  it('names each level the model reads, once', () => {
    expect(referencedLevels(MODEL)).toEqual(['realm', 'shire', 'guild', 'temple']);
  });

  it('a level takes tax only when the model reads it and it publishes what is read', () => {
    // The quarter has facts but no component names it; the guild is named but publishes nothing.
    expect(taxingLevels(MODEL, FACTS)).toEqual(['realm', 'shire', 'temple']);
  });
});

describe('validation', () => {
  it('accepts a sound model and tariff', () => {
    expect(modelProblems(MODEL)).toEqual([]);
    expect(
      tariffProblem(
        progressive([
          [0, 0],
          [100, 0.5],
        ])
      )
    ).toBeNull();
  });

  it('names each problem in a broken model', () => {
    const broken: TaxModel = {
      ...MODEL,
      base: 'wealth',
      variants: [],
      components: [MODEL.components[0]!, { ...MODEL.components[0]!, when: 'unknown' }],
    };
    expect(modelProblems(broken)).toEqual([
      'base "wealth" is not listed in inputs',
      'variants is empty',
      'component "realm" is declared twice',
      'component "realm" reads undeclared input "unknown"',
    ]);
  });

  it('rejects rates outside [0, 1], unsorted brackets and bad currencies', () => {
    expect(tariffProblem(progressive([[0, 1.5]]))).toMatch(/outside/);
    expect(
      tariffProblem(
        progressive([
          [0, 0],
          [0, 0.1],
        ])
      )
    ).toMatch(/does not start above/);
    expect(tariffProblem({ kind: 'flat', currency: 'chf', rate: 0.1 })).toMatch(/ISO 4217/);
  });
});

/**
 * The evaluator replaces src/domain/finances/tax.ts. Until the Swiss pack serves
 * these numbers from Solon, this pins the two equal on the one table we have,
 * so the switch cannot change anyone's estimate.
 */
describe('reproduces the current Zürich estimate', () => {
  const table = ZURICH_CITY_SINGLE_2025;
  const model: TaxModel = {
    schemaVersion: 1,
    base: 'taxable_income',
    inputs: ['taxable_income'],
    variants: ['single'],
    components: [
      { key: 'federal', tariff: { level: 'nation', metric: 'tariff' } },
      {
        key: 'cantonal_and_communal',
        tariff: { level: 'canton', metric: 'tariff.basic' },
        multipliers: table.multipliers.map((_, i) => ({ level: `m${i}`, metric: 'multiplier' })),
      },
    ],
  };
  const facts: Fact[] = [
    {
      level: 'nation',
      metric: 'tariff',
      value: { kind: 'progressive', currency: table.currency, brackets: table.federal },
    },
    {
      level: 'canton',
      metric: 'tariff.basic',
      value: { kind: 'progressive', currency: table.currency, brackets: table.cantonalBasic },
    },
    ...table.multipliers.map((m, i) => ({ level: `m${i}`, metric: 'multiplier', value: m.factor })),
  ];

  it.each([0, 20_000, 50_000, 100_000, 250_000, 1_000_000])('at %i', income => {
    const current = estimateIncomeTax(income, table);
    const next = evaluate(model, facts, {
      values: { taxable_income: income },
      variant: 'single',
    });
    expect(Math.round(next.total)).toBe(current.total);
    expect(Math.round(next.components[0]!.amount!)).toBe(current.federal);
    expect(Math.round(next.components[1]!.amount!)).toBe(current.cantonalAndCommunal);
  });
});
