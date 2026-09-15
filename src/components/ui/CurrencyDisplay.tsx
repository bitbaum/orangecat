/**
 * CurrencyDisplay Component
 *
 * Reusable component for displaying currency amounts with appropriate colors.
 * Automatically uses Bitcoin Orange for BTC amounts and neutral colors for others.
 *
 * Created: June 5, 2025
 * Last Modified: June 5, 2025
 * Last Modified Summary: Initial creation
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { APP_LOCALE } from '@/utils/locale';

interface CurrencyDisplayProps {
  amount: number | string;
  currency: 'BTC' | 'USD' | 'CHF' | 'EUR' | string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSymbol?: boolean;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount,
  currency,
  size = 'md',
  className,
  showSymbol = true,
}) => {
  const currencyColorClass =
    currency === 'BTC' ? 'text-bitcoinOrange font-medium' : 'text-fg-secondary';

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-medium',
    xl: 'text-xl font-semibold',
  };

  const formatAmount = (amount: number | string, currency: string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

    // Handle NaN or invalid numbers
    if (isNaN(numAmount) || !isFinite(numAmount)) {
      return showSymbol ? `0 ${currency}` : '0';
    }

    switch (currency) {
      case 'BTC':
        // BTC: up to 8 decimal places, remove trailing zeros
        const btcFormatted = numAmount.toFixed(8).replace(/\.?0+$/, '');
        return showSymbol ? `${btcFormatted} BTC` : btcFormatted;
      case 'USD':
        // Fiat currencies: 2 decimal places
        const usdFormatted = numAmount.toLocaleString(APP_LOCALE, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        return showSymbol ? `$${usdFormatted}` : usdFormatted;
      case 'CHF':
      case 'EUR':
      case 'GBP':
      case 'JPY':
      case 'CAD':
      case 'AUD':
      case 'NZD':
        // Fiat currencies: 2 decimal places (except JPY which is typically 0)
        const fiatFormatted =
          currency === 'JPY'
            ? Math.round(numAmount).toLocaleString(APP_LOCALE)
            : numAmount.toLocaleString(APP_LOCALE, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
        return showSymbol ? `${fiatFormatted} ${currency}` : fiatFormatted;
      default:
        // Unknown currencies: try to format as fiat (2 decimals)
        const defaultFormatted = numAmount.toLocaleString(APP_LOCALE, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        return showSymbol ? `${defaultFormatted} ${currency}` : defaultFormatted;
    }
  };

  return (
    <span
      className={cn(currencyColorClass, sizeClasses[size], 'font-mono tabular-nums', className)}
    >
      {formatAmount(amount, currency)}
    </span>
  );
};

export default CurrencyDisplay;
