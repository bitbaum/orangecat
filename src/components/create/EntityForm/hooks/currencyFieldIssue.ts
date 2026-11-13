import { CURRENCY_METADATA } from '@/config/currencies';
import type { FieldConfig } from '../../types';

/**
 * What a money field can be wrong about that its schema cannot see: an amount
 * finer than the currency it is held in. "0.001" in a franc field is a Bitcoin
 * amount typed under the wrong unit (the 2026-11-13 review), and the schema's
 * `positive()` lets it through. Returns the message to show, or null.
 */
export function currencyFieldIssue(
  field: Pick<FieldConfig, 'type' | 'storedIn'>,
  value: unknown,
  formCurrency: unknown
): string | null {
  if (field.type !== 'currency' || typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const currency = (field.storedIn ?? formCurrency) as keyof typeof CURRENCY_METADATA;
  const meta = CURRENCY_METADATA[currency];
  if (!meta || currency === 'BTC') {
    return null;
  }
  const scaled = value * 10 ** meta.precision;
  if (Math.abs(scaled - Math.round(scaled)) < 1e-6) {
    return null;
  }
  return `${currency} amounts stop at the cent. For a Bitcoin amount, switch the currency to BTC.`;
}
