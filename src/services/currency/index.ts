/**
 * CURRENCY SERVICE — thin re-export barrel.
 *
 * Sub-modules are the SSOT:
 *   types.ts       — shared interfaces
 *   rates.ts       — rate cache, CoinGecko service, async helpers
 *   conversion.ts  — sync BTC/fiat/sats conversions
 *   formatting.ts  — display formatting functions
 *   validation.ts  — input parsing and amount validation
 */

export { currencyConverter } from './rates';

export { satsToBitcoin, bitcoinToSats, convertBtcTo, convertToBtc, convert } from './conversion';

export {
  formatCurrency,
  formatAmountSuffixed,
  displayBTC,
  formatSats,
  formatBTC,
} from './formatting';

export { parseAmount, parseBTCAmount, validateBTCAmount } from './validation';
