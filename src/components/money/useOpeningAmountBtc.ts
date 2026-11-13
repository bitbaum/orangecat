'use client';

import { useState } from 'react';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { useUserCurrency } from '@/hooks/useUserCurrency';

/**
 * The amount a field opens at, as the payer reads it. A stated minimum of
 * 0.001 BTC opened an investment at "CHF 57.78": correct, and unround enough
 * to look computed. It opens at the minimum rounded UP to a whole unit of the
 * payer's currency (CHF 58), never below it, and never above `maxBtc` (then
 * the minimum itself). Nothing (0) stays nothing: the field opens empty.
 * Without a rate, or for someone reading BTC, the amount is left as it is.
 */
export function roundUpToWholeUnit(
  btc: number,
  maxBtc: number,
  toFiat: (btc: number) => number,
  toBtc: (fiat: number) => number
): number {
  if (!(btc > 0)) {
    return 0;
  }
  const fiat = toFiat(btc);
  if (!(fiat > 0)) {
    return btc;
  }
  const whole = Math.ceil(fiat - 1e-9);
  // Up to the next satoshi, so the converted amount never falls under the bound.
  const rounded = Math.ceil(toBtc(whole) * 1e8 - 1e-6) / 1e8;
  if (!(rounded >= btc) || rounded > maxBtc) {
    return btc;
  }
  return rounded;
}

export function useOpeningAmountBtc(btc: number, maxBtc: number): number {
  const currency = useUserCurrency();
  const { convertFromBTC, convertToBTC } = useCurrencyConversion();
  if (currency === 'BTC') {
    return btc;
  }
  return roundUpToWholeUnit(
    btc,
    maxBtc,
    b => convertFromBTC(b, currency),
    f => convertToBTC(f, currency)
  );
}

/**
 * An amount field's value: what the payer chose, else the opening amount.
 * Held as null until they choose, so the opening follows the rate as it lands.
 */
export function useChosenAmountBtc(
  range: { defaultBtc: number; maxBtc: number },
  initial?: number | null
) {
  const opening = useOpeningAmountBtc(range.defaultBtc, range.maxBtc);
  const [chosen, setChosen] = useState<number | null>(initial ?? null);
  return [chosen ?? opening, setChosen] as const;
}
