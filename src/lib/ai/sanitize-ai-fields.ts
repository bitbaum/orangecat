/**
 * Coerce AI-returned form values against the form's declared fields.
 *
 * The prompt tells the model to use option *values*, ISO dates, numbers — but
 * a prompt is a request, not a guarantee. The fleet's form filler
 * (`ai-forms`, via `@bitbaum/ai-kit/forms`) is the enforcement: a select
 * answered with its label ("Cleaning") maps back to its value ("cleaning"),
 * numbers arrive as numbers, tags as a string array, and a value that cannot
 * be made valid is dropped rather than written into the form.
 *
 * Two OrangeCat rules sit on top of it:
 * - Fields the AI returned that are NOT declared pass through untouched —
 *   some flows carry companion values (e.g. `currency` next to a price field)
 *   that the field list doesn't declare, and dropping them would regress
 *   those forms. A `null` for a declared field passes too: it is an explicit
 *   clear, not a guess.
 * - A number outside the field's range is dropped, not clamped. The package
 *   clamps; a clamped price is a price nobody said.
 */

import { sanitizeValues } from '@bitbaum/ai-kit/forms';
import { toFieldSpecs } from './field-spec';
import type { FieldConfig } from '@/components/create/types';

/** A Bitcoin amount the user actually stated — "0.01 BTC", "₿0.5", "in bitcoin". */
const MENTIONS_BITCOIN = /\b(btc|bitcoin|sats?|satoshis?)\b|₿/i;

/**
 * Drop `*_btc` values the user never gave in Bitcoin.
 *
 * Some entities only have a BTC-denominated price field — an asset has
 * `rental_price_btc` and no fiat equivalent — so a model told "1800 a month"
 * has one field to put it in and converts. It has no exchange rate, so the
 * number is invented: "rent out my apartment in Basel for 1800 a month" came
 * back as `rental_price_btc: 0.072`, roughly double what the person said, next
 * to `currency: CHF` contradicting it.
 *
 * The prompt says not to. A prompt is a request; this is the enforcement, and
 * the stakes justify it — the number goes on a listing someone gets charged
 * against. Absent beats invented: the field stays empty and the user fills in
 * the amount they meant.
 */
function dropUnstatedBitcoinAmounts(
  data: Record<string, unknown>,
  sourceText: string
): Record<string, unknown> {
  if (MENTIONS_BITCOIN.test(sourceText)) {
    return data;
  }
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (/_btc$/.test(key) && typeof value === 'number') {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

/** The number the model wrote, if it wrote one — to tell a clamp from a parse. */
function numberIn(raw: unknown): number | undefined {
  if (typeof raw === 'number') {
    return raw;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const num = Number(raw);
    return Number.isNaN(num) ? undefined : num;
  }
  return undefined;
}

/**
 * Validate/coerce `data` against `fields`. Declared fields are coerced to the
 * declared type (invalid → dropped); undeclared fields pass through unchanged.
 *
 * `sourceText` is what the user wrote; it is used to reject Bitcoin amounts
 * they never stated. Omit it only where no user text exists.
 */
export function sanitizeAiFields(
  data: Record<string, unknown>,
  fields: readonly FieldConfig[],
  sourceText = ''
): Record<string, unknown> {
  const safe = dropUnstatedBitcoinAmounts(data, sourceText);
  const specs = toFieldSpecs(fields);
  const declared = new Map(specs.map(spec => [spec.name, spec]));
  const coerced = sanitizeValues(safe, specs);

  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(safe)) {
    const spec = declared.get(key);
    if (!spec) {
      result[key] = raw;
      continue;
    }
    if (raw === null) {
      result[key] = null;
      continue;
    }
    if (!(key in coerced)) {
      continue;
    }
    const value = coerced[key];
    if (spec.type === 'number') {
      const said = numberIn(raw);
      const outOfRange =
        said !== undefined &&
        ((spec.min !== undefined && said < spec.min) ||
          (spec.max !== undefined && said > spec.max));
      if (outOfRange) {
        continue;
      }
    }
    result[key] = value;
  }
  return result;
}
