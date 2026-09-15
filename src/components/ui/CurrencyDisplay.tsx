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
import { formatAmountSuffixed } from '@/services/currency';

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


  return (
    <span
      className={cn(currencyColorClass, sizeClasses[size], 'font-mono tabular-nums', className)}
    >
      {formatAmountSuffixed(amount, currency, { showSymbol })}
    </span>
  );
};

export default CurrencyDisplay;
