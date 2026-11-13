'use client';

import { useState, useEffect, useMemo } from 'react';
import { Currency, FIAT_CURRENCIES } from '@/types/settings';
import { convert, parseAmount } from '@/services/currency';
import { getRate } from '@/services/currency/rates';
import { CURRENCY_METADATA, PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { useRatesReady } from '@/components/providers/CurrencyRatesProvider';

/**
 * An amount as the field shows it. BTC to eight places, trimmed. Fiat to two,
 * unless the stored amount has more: 0.0025 CHF used to show as "0.00" and
 * pass "positive" validation unseen. A converted amount is an equivalent and
 * is rounded to the currency's places.
 */
function formatAmount(amount: number, currency: Currency, converted: boolean): string {
  if (currency === 'BTC') {
    return amount.toFixed(8).replace(/\.?0+$/, '');
  }
  const cents = amount * 100;
  if (converted || Math.abs(cents - Math.round(cents)) < 1e-6) {
    return amount.toFixed(2);
  }
  return String(amount);
}

/**
 * `propCurrency` is the currency `value` is stored in. `entryCurrency` is the
 * one the amount is typed and shown in (default: the stored one); they differ
 * for a column that always holds BTC. With `onCurrencyChange`, the owner holds
 * the entry currency and converts its amounts; without it, the switch only
 * changes what this field is typed and shown in.
 */
export function useCurrencyInput(
  propCurrency: Currency,
  value: number | null,
  onChange: (amount: number | null) => void,
  onCurrencyChange: ((currency: Currency) => void) | undefined,
  defaultCurrency: Currency = PLATFORM_DEFAULT_CURRENCY,
  userCurrency: Currency | undefined,
  showBreakdown: boolean,
  entryCurrency?: Currency
) {
  const [chosenCurrency, setChosenCurrency] = useState<Currency>(
    entryCurrency || propCurrency || userCurrency || defaultCurrency
  );
  const [localValue, setLocalValue] = useState<string>('');
  const [isUserEditing, setIsUserEditing] = useState<boolean>(false);
  // The unit an edit started in, held until blur. Worked out afresh on every
  // keystroke, a rate expiring mid-edit flipped it to the stored unit and the
  // whole typed string was read again in that unit: "30000" typed as CHF was
  // stored as 30000 BTC.
  const [editCurrency, setEditCurrency] = useState<Currency | null>(null);
  // Re-render when rates land, so a field held in BTC for want of a rate
  // moves to the chosen currency.
  useRatesReady();

  useEffect(() => {
    const next = entryCurrency || propCurrency;
    if (next) {
      setChosenCurrency(next);
    }
    // A switch from the owner ends the edit: the field is shown again in the
    // new unit rather than keeping digits typed in the old one.
    setEditCurrency(null);
    setIsUserEditing(false);
  }, [entryCurrency, propCurrency]);

  // Typed in one currency and stored in another needs both rates. Without
  // them the field is typed in the stored currency, never converted to 0.
  const inputCurrency: Currency =
    editCurrency ??
    (chosenCurrency === propCurrency ||
    (getRate(chosenCurrency) !== null && getRate(propCurrency) !== null)
      ? chosenCurrency
      : propCurrency);

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
      const converted = inputCurrency !== propCurrency;
      const shown = converted ? convert(numValue, propCurrency, inputCurrency) : numValue;
      setLocalValue(formatAmount(shown, inputCurrency, converted));
    }
  }, [value, inputCurrency, propCurrency, isUserEditing]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    setLocalValue(rawValue);
    setIsUserEditing(true);
    if (editCurrency === null) {
      setEditCurrency(inputCurrency);
    }

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
    // When they differ, convert the TYPED amount, rounded to what the stored
    // unit can hold (eight places for BTC), so validation sees what is saved.
    if (inputCurrency === propCurrency) {
      onChange(parsed);
      return;
    }
    const places = CURRENCY_METADATA[propCurrency].precision;
    onChange(Number(convert(parsed, inputCurrency, propCurrency).toFixed(places)));
  };

  const handleCurrencyChange = (newCurrency: Currency) => {
    // The owner converts every amount the form holds (one place, so a sibling
    // is never left with its number under the new unit) and hands the new
    // currency back through the props. If it refuses, nothing moves.
    if (onCurrencyChange) {
      onCurrencyChange(newCurrency);
      return;
    }
    // On its own the field keeps what it stores; only the unit it is typed
    // and shown in changes.
    setIsUserEditing(false);
    setEditCurrency(null);
    setChosenCurrency(newCurrency);
  };

  const handleBlur = (onBlur: (() => void) | undefined) => {
    setIsUserEditing(false);
    setEditCurrency(null);
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
