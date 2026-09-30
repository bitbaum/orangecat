/**
 * @bitbaum/tax-model — a tax formula as data, and the pure evaluator that turns
 * it into an estimate. Knows no country: levels, metrics and currencies come
 * from the model and the facts it is given.
 */
export {
  TAX_MODEL_SCHEMA_VERSION,
  componentRefs,
  modelProblems,
  tariffProblem,
  type Bracket,
  type DivisorRef,
  type Fact,
  type FactRef,
  type MultiplierRef,
  type Tariff,
  type TaxComponent,
  type TaxModel,
} from './model';
export {
  applyTariff,
  evaluate,
  referencedLevels,
  taxingLevels,
  type ComponentResult,
  type Estimate,
  type EvaluateInput,
} from './evaluate';
