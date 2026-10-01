# @bitbaum/tax-model

_Created 2026-09-29. Last modified 2026-10-01: 0.5.0, schema version 4: a tariff's `rounding` (the base, and the divided base whose rate then applies to the whole) and a multiplier's `reducedBy` (a share cut from the tariff amount for that multiplier only). Earlier the same day: 0.4.0, schema version 3: `stepped` tariffs (the tax each step states, plus its rate on the excess) and `average` tariffs (an interpolated average rate on the whole amount). Earlier the same day: 0.3.0, `componentRefs`; 0.2.0, schema version 2: a
component's `divisor` applies the tariff to a divided base (a couple's income
split in two, a family quotient). Earlier, 2026-09-29: first version (P0 of
Solon's Places design)._

A **tax formula as data**, and the **pure evaluator** that turns it into an
estimate. It knows no country: levels, metric keys and currencies come from the
model and the facts it is given. Design: Solon
`docs/design/2026-09-places-and-jurisdictions.md` §6.

| Export                             | Does                                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TaxModel`, `Fact`, `Tariff`       | the shapes: components reading a tariff from one level, times the sum of multipliers from others; a `divisor` applies the tariff to base ÷ d and multiplies it back (splitting); a multiplier's `reducedBy` cuts a share off that multiplier only |
| `evaluate(model, facts, input)`    | the estimate: per component, total, effective rate, currency, and which facts were missing                                                                                                                                                        |
| `applyTariff(base, tariff)`        | marginal layers, a flat rate, stated steps or an interpolated average rate, with an optional cap and `rounding` of the base down to a step                                                                                                        |
| `referencedLevels`, `taxingLevels` | which levels a model reads, and which of them take tax in a set of facts                                                                                                                                                                          |
| `componentRefs`                    | every fact a component reads (tariff, divisor, multipliers, reductions), for callers that load or count facts                                                                                                                                     |
| `modelProblems`, `tariffProblem`   | validation for config and importers                                                                                                                                                                                                               |

It does no I/O and reads no clock, so it runs in the browser and a person's
income never leaves their device. It never guesses: a missing required fact
makes the estimate incomplete and is named in `missing`.

## Who uses it

- **OrangeCat**: finances and the civic split. A test pins it equal to the
  current `src/domain/finances/tax.ts` on the Zürich table until that file is
  retired.
- **Solon**: the Places map and `/compare`. Solon keeps a byte-for-byte copy
  in `src/lib/tax-model/`, checked against this directory by its
  `check:vendored-drift` gate, until this package has its own repository, like
  `@bitbaum/collective-kinds`.

## Changing it

1. Edit `src/`. A new tariff shape is a new `Tariff` kind and a
   `schemaVersion` bump, never a country-specific branch. A model states the
   version it needs, so an older evaluator refuses a newer model instead of
   ignoring what it cannot read.
2. Run OrangeCat's tests (`__tests__/unit/packages/tax-model.test.ts`).
3. Copy `src/` to Solon's vendored directory and keep its header.
