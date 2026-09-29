# @bitbaum/tax-model

_Created 2026-09-29. Last modified 2026-09-29: first version (P0 of Solon's
Places design)._

A **tax formula as data**, and the **pure evaluator** that turns it into an
estimate. It knows no country: levels, metric keys and currencies come from the
model and the facts it is given. Design: Solon
`docs/design/2026-09-places-and-jurisdictions.md` §6.

| Export                             | Does                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `TaxModel`, `Fact`, `Tariff`       | the shapes: components reading a tariff from one level, times the sum of multipliers from others |
| `evaluate(model, facts, input)`    | the estimate: per component, total, effective rate, currency, and which facts were missing       |
| `applyTariff(base, tariff)`        | marginal layers or a flat rate, with an optional cap                                             |
| `referencedLevels`, `taxingLevels` | which levels a model reads, and which of them take tax in a set of facts                         |
| `modelProblems`, `tariffProblem`   | validation for config and importers                                                              |

It does no I/O and reads no clock, so it runs in the browser and a person's
income never leaves their device. It never guesses: a missing required fact
makes the estimate incomplete and is named in `missing`.

## Who uses it

- **OrangeCat**: finances and the civic split. A test pins it equal to the
  current `src/domain/finances/tax.ts` on the Zürich table until that file is
  retired.
- **Solon** (next, not yet vendored): the Places map, compare and move planner.
  Solon will keep a byte-for-byte copy until this package has its own
  repository, like `@bitbaum/collective-kinds`.

## Changing it

1. Edit `src/`. A new tariff shape is a new `Tariff` kind and a
   `schemaVersion` bump, never a country-specific branch.
2. Run OrangeCat's tests (`__tests__/unit/packages/tax-model.test.ts`).
3. Copy `src/` to Solon's vendored directory and keep its header.
