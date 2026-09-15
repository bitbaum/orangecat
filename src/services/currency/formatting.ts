/**
 * Currency Formatting & Display
 *
 * All user-facing currency formatting functions.
 */

import { CURRENCY_METADATA } from '@/config/currencies';
import { APP_LOCALE } from '@/utils/locale';

// ==================== GENERAL FORMATTING ====================

export function formatCurrency(
  amount: number,
  currency: string,
  options: {
    showSymbol?: boolean;
    compact?: boolean;
    locale?: string;
  } = {}
): string {
  const { showSymbol = true, compact = false, locale = 'en-US' } = options;
  const metadata = CURRENCY_METADATA[currency as keyof typeof CURRENCY_METADATA];

  if (!metadata) {
    return amount.toLocaleString(locale);
  }

  if (currency === 'BTC') {
    const formatted = amount.toFixed(8).replace(/\.?0+$/, '');
    return showSymbol ? `₿${formatted}` : formatted;
  }

  // Fiat currencies
  const formatted = amount.toLocaleString(locale, {
    minimumFractionDigits: compact ? 0 : metadata.precision,
    maximumFractionDigits: metadata.precision,
  });

  if (!showSymbol) {
    return formatted;
  }

  switch (currency) {
    case 'USD':
      return `$${formatted}`;
    case 'EUR':
      return `€${formatted}`;
    case 'GBP':
      return `£${formatted}`;
    case 'CHF':
      return `CHF ${formatted}`;
    default:
      return `${formatted} ${currency}`;
  }
}

/**
 * The suffixed rendering used by <CurrencyDisplay>: "0.001 BTC", "$1,234.00",
 * "1,234.00 CHF".
 *
 * Deliberately NOT formatCurrency() above. That one prefixes Bitcoin with the
 * ₿ sign and Swiss francs with "CHF "; this one suffixes the ticker, and is
 * what every amount on a project, profile or dashboard card has rendered as.
 * It also tolerates a string amount and a NaN, because it sits directly on
 * values coming out of the database as numerics.
 *
 * It lived inside the component. It is currency-formatting knowledge, so it
 * lives here with the rest of it — same output, one module.
 */
export function formatAmountSuffixed(
  amount: number | string,
  currency: string,
  options: { showSymbol?: boolean } = {}
): string {
  const { showSymbol = true } = options;
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return showSymbol ? `0 ${currency}` : '0';
  }

  switch (currency) {
    case 'BTC': {
      // BTC: up to 8 decimal places, remove trailing zeros
      const btcFormatted = numAmount.toFixed(8).replace(/\.?0+$/, '');
      return showSymbol ? `${btcFormatted} BTC` : btcFormatted;
    }
    case 'USD': {
      // Fiat currencies: 2 decimal places
      const usdFormatted = numAmount.toLocaleString(APP_LOCALE, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return showSymbol ? `$${usdFormatted}` : usdFormatted;
    }
    case 'CHF':
    case 'EUR':
    case 'GBP':
    case 'JPY':
    case 'CAD':
    case 'AUD':
    case 'NZD': {
      // Fiat currencies: 2 decimal places (except JPY which is typically 0)
      const fiatFormatted =
        currency === 'JPY'
          ? Math.round(numAmount).toLocaleString(APP_LOCALE)
          : numAmount.toLocaleString(APP_LOCALE, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
      return showSymbol ? `${fiatFormatted} ${currency}` : fiatFormatted;
    }
    default: {
      // Unknown currencies: try to format as fiat (2 decimals)
      const defaultFormatted = numAmount.toLocaleString(APP_LOCALE, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return showSymbol ? `${defaultFormatted} ${currency}` : defaultFormatted;
    }
  }
}

// ==================== BITCOIN DISPLAY ====================

export function formatBitcoinDisplay(amount: number): string {
  // BTC is the only user-facing Bitcoin unit — small amounts get more
  // precision, never a satoshi rendering.
  if (amount >= 1) {
    return `${amount.toFixed(4)} BTC`;
  } else if (amount >= 0.001) {
    return `${amount.toFixed(6)} BTC`;
  }
  return `${amount.toFixed(8).replace(/0+$/, '')} BTC`;
}

export function formatBTC(amount: number): string {
  const value = typeof amount === 'number' && isFinite(amount) ? amount : 0;
  return `${value.toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 8,
    maximumFractionDigits: 8,
  })} BTC`;
}

export function formatSats(amount: number): string {
  const value = typeof amount === 'number' && isFinite(amount) ? Math.round(amount) : 0;
  return `${value.toLocaleString(APP_LOCALE)} sat`;
}

/**
 * Format BTC for clean display — strips unnecessary trailing zeros.
 * 0.001 → "0.001", 0.00500000 → "0.005", 1.0 → "1"
 */
export function displayBTC(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (!isFinite(num) || num === 0) {
    return '0 BTC';
  }
  // Show up to 8 decimals but strip trailing zeros
  return `${parseFloat(num.toFixed(8))} BTC`;
}
