'use client';

import { useState, useEffect, useMemo } from 'react';
import { Currency, FIAT_CURRENCIES } from '@/types/settings';
import { convert, parseAmount } from '@/services/currency';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';

export function useCurrencyInput(
  propCurrency: Currency,
  value: number | null,
  onChange: (amount: number | null) => void,
  onCurrencyChange: ((currency: Currency) => void) | undefined,
  defaultCurrency: Currency = PLATFORM_DEFAULT_CURRENCY,
  userCurrency: Currency | undefined,
  showBreakdown: boolean
) {
  const [inputCurrency, setInputCurrency] = useState<Currency>(
    propCurrency || userCurrency || defaultCurrency
  );
  const [localValue, setLocalValue] = useState<string>('');
  const [isUserEditing, setIsUserEditing] = useState<boolean>(false);

  useEffect(() => {
    if (propCurrency) {
      setInputCurrency(propCurrency);
    }
  }, [propCurrency]);

  useEffect(() => {
    if (value === null || value === undefined) {
      setLocalValue('');
      setIsUserEditing(false);
      return;
    }

    // Coerce to number — AI prefill may pass strings even though type says number
    const numValue = Number(value);
    if (isNaN(numValue)) {
      setLocalValue('');
      setIsUserEditing(false);
      return;
    }

    if (!isUserEditing) {
      let formatted: string;
      if (inputCurrency === 'BTC') {
        formatted = numValue.toFixed(8).replace(/\.?0+$/, '');
      } else {
        formatted = numValue.toFixed(2);
      }
      setLocalValue(formatted);
    }
  }, [value, inputCurrency, isUserEditing]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setLocalValue(rawValue);
    setIsUserEditing(true);

    const parsed = parseAmount(rawValue);
    if (parsed === null) {
      onChange(null);
      return;
    }

    // What was typed is what is sent. This used to clamp to `min`/`max` on
    // every keystroke: with min 1 on a price, typing 0.0005 BTC stored 1 BTC
    // and the field jumped to "1" on blur. Limits belong to validation, which
    // can say so, not to the keyboard, which silently rewrites the amount.
    //
    // A typed number is in the input's currency; the form stores the field's.
    // When they differ (the switch was used without onCurrencyChange), convert
    // the TYPED amount — it used to send a conversion of the old value instead.
    onChange(inputCurrency !== propCurrency ? convert(parsed, inputCurrency, propCurrency) : parsed);
  };

  const handleCurrencyChange = (newCurrency: Currency) => {
    if (value !== null && value !== undefined) {
      const converted = convert(value, inputCurrency, newCurrency);
      onChange(converted);
    }
    setInputCurrency(newCurrency);
    onCurrencyChange?.(newCurrency);
  };

  const handleBlur = (onBlur: (() => void) | undefined) => {
    setIsUserEditing(false);
    onBlur?.();
  };

  const breakdown = useMemo(() => {
    if (!showBreakdown || !value || value === 0) {
      return null;
    }

    const otherCurrencies: Record<string, number> = {};
    FIAT_CURRENCIES.forEach(curr => {
      if (curr !== inputCurrency) {
        otherCurrencies[curr] = convert(value, inputCurrency, curr);
      }
    });

    const btcValue = inputCurrency === 'BTC' ? value : convert(value, inputCurrency, 'BTC');
    return { btc: btcValue, other: otherCurrencies };
  }, [value, inputCurrency, showBreakdown]);

  return {
    inputCurrency,
    localValue,
    breakdown,
    handleInputChange,
    handleCurrencyChange,
    handleBlur,
  };
}
