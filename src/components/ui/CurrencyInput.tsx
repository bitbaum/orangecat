'use client';

import { ArrowLeftRight, Bitcoin, Info } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Currency, ALL_CURRENCIES } from '@/types/settings';
import { formatCurrency } from '@/services/currency';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { getGoalExplanation } from '@/utils/currency-helpers';
import { useCurrencyInput } from './useCurrencyInput';

interface CurrencyInputProps {
  value: number | null;
  currency: Currency;
  onChange: (amount: number | null) => void;
  onCurrencyChange?: (currency: Currency) => void;
  defaultCurrency?: Currency;
  userCurrency?: Currency;
  label?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  showBreakdown?: boolean;
  allowCurrencySwitch?: boolean;
  /**
   * True ONLY for funding-goal fields (project/cause/event goals). Shows the
   * "goal can be reached by contributions OR Bitcoin price appreciation"
   * explainer — that copy is meaningless (and confusing) on price fields.
   */
  isGoal?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Accepted for config compatibility; limits are enforced by validation,
   *  never by rewriting what was typed (see useCurrencyInput). */
  min?: number;
  max?: number;
  id?: string;
}

export function CurrencyInput({
  value,
  currency: propCurrency,
  onChange,
  onCurrencyChange,
  defaultCurrency = PLATFORM_DEFAULT_CURRENCY,
  userCurrency,
  label,
  placeholder,
  error,
  hint,
  disabled = false,
  showBreakdown = false,
  allowCurrencySwitch = true,
  isGoal = false,
  onFocus,
  onBlur,
  id,
}: CurrencyInputProps) {
  const {
    inputCurrency,
    localValue,
    breakdown,
    handleInputChange,
    handleCurrencyChange,
    handleBlur,
  } = useCurrencyInput(
    propCurrency,
    value,
    onChange,
    onCurrencyChange,
    defaultCurrency,
    userCurrency,
    showBreakdown
  );

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-fg-primary">
          {label}
        </label>
      )}

      <div className="relative">
        <div className="flex">
          <Input
            id={id}
            type="text"
            inputMode="decimal"
            value={localValue}
            onChange={handleInputChange}
            onFocus={onFocus}
            onBlur={() => handleBlur(onBlur)}
            placeholder={placeholder || '0.00'}
            disabled={disabled}
            className={`rounded-r-none ${error ? 'border-destructive' : ''}`}
          />

          {allowCurrencySwitch ? (
            <select
              value={inputCurrency}
              onChange={e => handleCurrencyChange(e.target.value as Currency)}
              disabled={disabled}
              className="px-3 py-2 border border-l-0 border-border-strong rounded-r-md bg-muted text-sm font-medium text-fg-primary focus:ring-2 focus:ring-ring focus:border-ring cursor-pointer"
            >
              {ALL_CURRENCIES.map(curr => (
                <option key={curr} value={curr}>
                  {curr}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-2 border border-l-0 border-border-strong rounded-r-md bg-muted text-sm font-medium text-fg-primary">
              {inputCurrency}
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
      {hint && !error && <p className="text-xs text-fg-secondary">{hint}</p>}

      {isGoal && !error && !hint && value && value > 0 && (
        <div className="text-xs text-fg-secondary mt-1">
          <span className="flex items-center gap-1">
            <Info className="w-3 h-3" />
            <span>{getGoalExplanation(inputCurrency)}</span>
          </span>
        </div>
      )}

      {showBreakdown && breakdown && value && value > 0 && (
        <div className="mt-3 p-3 rounded-lg bg-bitcoinOrange/5 border border-bitcoinOrange/20">
          <div className="flex items-center gap-2 mb-2">
            <ArrowLeftRight className="w-4 h-4 text-bitcoinOrange" />
            <span className="text-xs font-semibold text-fg-primary">
              Equivalent in other currencies
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {inputCurrency !== 'BTC' && (
              <div className="flex justify-between items-center">
                <span className="text-fg-secondary flex items-center gap-1">
                  <Bitcoin className="w-3 h-3" />
                  BTC
                </span>
                <span className="font-mono font-semibold">
                  {breakdown.btc.toFixed(8).replace(/\.?0+$/, '')}
                </span>
              </div>
            )}

            {Object.entries(breakdown.other)
              .slice(0, inputCurrency === 'BTC' ? 3 : 2)
              .map(([curr, amount]) => (
                <div key={curr} className="flex justify-between items-center">
                  <span className="text-fg-secondary">{curr}</span>
                  <span className="font-mono font-medium text-fg-primary">
                    {formatCurrency(amount, curr as Currency, { showSymbol: false })}
                  </span>
                </div>
              ))}
          </div>

          <div className="mt-2 pt-2 border-t border-bitcoinOrange/20 flex items-start gap-1">
            <Info className="w-3 h-3 text-bitcoinOrange mt-0.5 flex-shrink-0" />
            <p className="text-xs text-fg-secondary">
              All transactions settle in Bitcoin. Amounts shown are estimates based on current
              exchange rates.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface CurrencyDisplayProps {
  amount: number;
  currency: Currency;
  showBreakdown?: boolean;
  className?: string;
}

export function CurrencyDisplay({
  amount,
  currency,
  showBreakdown: _showBreakdown = false,
  className = '',
}: CurrencyDisplayProps) {
  return (
    <div className={className}>
      <span className="font-semibold">{formatCurrency(amount, currency)}</span>
    </div>
  );
}
