/**
 * The two pure helpers behind typing an amount, shared by the field that is
 * typed into and the suggestions beside it.
 */

import { CURRENCY_METADATA } from '@/config/currencies';

export const BTC_DECIMALS = CURRENCY_METADATA.BTC.precision;

/** A value the input can hold: plain digits, no thousands separators. */
export function toDraft(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return '';
  }
  return amount.toFixed(decimals).replace(/\.?0+$/, '');
}

/** Accept what a European keyboard produces; keep one separator, digits only. */
export function sanitize(raw: string): string {
  const unified = raw.replace(',', '.').replace(/[^\d.]/g, '');
  const [head, ...rest] = unified.split('.');
  return rest.length > 0 ? `${head}.${rest.join('')}` : head;
}
