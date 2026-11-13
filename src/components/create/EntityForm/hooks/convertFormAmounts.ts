import { convert } from '@/services/currency';
import { getRate } from '@/services/currency/rates';
import { CURRENCY_METADATA, isSupportedCurrency } from '@/config/currencies';
import type { FieldConfig } from '../../types';

export type ConvertedAmounts =
  { ok: true; amounts: Record<string, number> } | { ok: false; fields: string[] };

/** Shown on an amount when the switch is refused for want of a rate. */
export const NO_RATE_FOR_SWITCH =
  "Today's Bitcoin rate has not loaded, so the currency was not changed. Try again in a moment.";

/**
 * The amounts a form holds once its currency changes from `from` to `to`.
 *
 * A form stores every amount in one currency (the entity's `currency`), and
 * each money field's switch changes that currency. The switch used to convert
 * only the field it sat on: every other amount kept its number under the new
 * unit, so CHF 25 became 25 BTC and a CHF 8,000 balance 8,000 BTC. Here every
 * amount kept in the form's currency is converted at today's rate, rounded to
 * what the field shows, so what is on screen is what is sent. A field with
 * `storedIn` keeps its own currency and is left alone.
 *
 * When an amount needs a rate we do not have, the switch is refused
 * (`ok: false`, naming the fields) rather than writing 0.
 */
export function convertFormAmounts(
  data: Record<string, unknown>,
  fields: readonly FieldConfig[],
  from: unknown,
  to: unknown
): ConvertedAmounts {
  if (from === to || !isSupportedCurrency(String(from)) || !isSupportedCurrency(String(to))) {
    return { ok: true, amounts: {} };
  }
  const source = String(from);
  const target = String(to) as keyof typeof CURRENCY_METADATA;
  const ratesKnown = getRate(source) !== null && getRate(target) !== null;
  const amounts: Record<string, number> = {};
  const unconvertible: string[] = [];
  for (const field of fields) {
    if (field.type !== 'currency' || field.storedIn) {
      continue;
    }
    const raw = data[field.name];
    if (raw === null || raw === undefined || raw === '') {
      continue;
    }
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount === 0) {
      continue;
    }
    if (!ratesKnown) {
      unconvertible.push(field.name);
      continue;
    }
    amounts[field.name] = Number(
      convert(amount, source, target).toFixed(CURRENCY_METADATA[target].precision)
    );
  }
  return unconvertible.length > 0 ? { ok: false, fields: unconvertible } : { ok: true, amounts };
}
