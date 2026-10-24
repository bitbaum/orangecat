/**
 * A request asked for in a currency: what the ask is worth in Bitcoin today.
 *
 * "CHF 20" is the ask; the BTC that settles it is whatever CHF 20 buys on the
 * day the payer arrives. Null means we have no rate we can stand behind — never
 * a zero that looks like an amount.
 */

import { CURRENCY_CODES, CURRENCY_METADATA, type CurrencyCode } from '@/config/currencies';
import { convertToBtcOrNull } from '@/services/currency/rates.server';

const BTC_DECIMALS = CURRENCY_METADATA.BTC.precision;

/**
 * Rates move between the invoice being minted and the payment being seen, so a
 * request asked for in a currency counts as answered a little short of the ask.
 * A request in BTC keeps the tighter REQUEST_PAID_TOLERANCE: there is no rate in it.
 */
export const FIAT_ASK_TOLERANCE = 0.98;

export interface RequestAsk {
  amount: number;
  currency: CurrencyCode;
}

/** The currencies a request can be held in: every fiat one we price in. */
export const isAskCurrency = (value: unknown): value is CurrencyCode =>
  typeof value === 'string' &&
  value !== 'BTC' &&
  (CURRENCY_CODES as readonly string[]).includes(value);

export function roundAsk(amount: number, currency: CurrencyCode): number {
  const factor = 10 ** CURRENCY_METADATA[currency].precision;
  return Math.round(amount * factor) / factor;
}

export async function askToBtcOrNull(ask: RequestAsk): Promise<number | null> {
  const btc = await convertToBtcOrNull(ask.amount, ask.currency);
  return btc !== null && Number.isFinite(btc) && btc > 0 ? Number(btc.toFixed(BTC_DECIMALS)) : null;
}
