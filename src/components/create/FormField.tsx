'use client';

/**
 * FORM FIELD COMPONENT
 *
 * Unified form field component that renders different input types
 * based on the field configuration.
 *
 * Created: 2025-12-03
 * Last Modified: 2025-12-04
 * Last Modified Summary: Added currency input support with multi-currency display
 */

import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import type { FormFieldProps } from './types';
import type { Currency } from '@/types/settings';
import { AvailabilityEditor } from './fields/AvailabilityEditor';
import { ImageField } from './fields/ImageField';

// ==================== COMPONENT ====================

export function FormField({
  config,
  value,
  error,
  onChange,
  onFocus,
  onBlur,
  disabled = false,
  onCurrencyChange,
  currency,
}: FormFieldProps) {
  const userCurrency = useUserCurrency();
  const { name, label, type, placeholder, required, options, hint, min, max, rows = 4 } = config;

  const baseInputClass = error
    ? 'border-status-negative focus:ring-status-negative/20'
    : 'border-strong';

  const renderInput = () => {
    switch (type) {
      case 'textarea':
        return (
          <>
            <Textarea
              id={name}
              value={(value as string) || ''}
              onChange={e => onChange(e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              placeholder={placeholder}
              rows={rows}
              disabled={disabled}
              className={baseInputClass}
            />
          </>
        );

      case 'number':
        return (
          <Input
            id={name}
            type="number"
            value={(value as string | number) ?? ''}
            onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : null)}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder}
            min={min}
            max={max}
            step={config.step}
            disabled={disabled}
            className={baseInputClass}
          />
        );

      case 'currency':
        // Use currency from form state, or fall back to user's preference
        const currentCurrency = (currency || userCurrency) as Currency;
        return (
          <CurrencyInput
            id={name}
            value={(value as number | null) ?? null}
            currency={currentCurrency}
            onChange={onChange}
            onCurrencyChange={onCurrencyChange}
            onFocus={onFocus}
            placeholder={placeholder}
            disabled={disabled}
            defaultCurrency={userCurrency}
            userCurrency={userCurrency}
            showBreakdown={false} // Don't show breakdown by default (no sats!)
            allowCurrencySwitch={true}
            isGoal={config.isGoal}
            min={min}
            max={max}
          />
        );

      case 'select': {
        // The chosen option's meaning, where the choice is made — not in a
        // guidance panel a screen away.
        const chosen = options?.find(o => o.value === value)?.description;
        return (
          <>
            <select
              id={name}
              value={(value as string) || ''}
              onChange={e => onChange(e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              disabled={disabled}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:border-interactive transition-colors ${baseInputClass} ${
                disabled ? 'bg-surface-raised cursor-not-allowed' : ''
              }`}
            >
              <option value="">Select {label.toLowerCase()}</option>
              {options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {chosen && <p className="mt-1.5 text-xs text-fg-secondary">{chosen}</p>}
          </>
        );
      }

      case 'radio':
        return (
          <div className="space-y-2">
            {options?.map(option => (
              <label key={option.value} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={value === option.value}
                  onChange={e => onChange(e.target.value)}
                  onFocus={onFocus}
                  disabled={disabled}
                  className="mt-1"
                />
                <div>
                  <span className="text-sm font-medium text-fg-primary">{option.label}</span>
                  {option.description && (
                    <p className="text-xs text-fg-secondary">{option.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              id={name}
              checked={!!value}
              onChange={e => onChange(e.target.checked)}
              onFocus={onFocus}
              disabled={disabled}
              className="w-4 h-4 rounded border-strong text-fg-primary focus:ring-ring"
            />
            <span className="text-sm text-fg-primary">{placeholder || label}</span>
          </label>
        );

      case 'url':
      case 'email':
        return (
          <Input
            id={name}
            type={type}
            value={(value as string) || ''}
            onChange={e => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={baseInputClass}
          />
        );

      case 'bitcoin_address':
        return (
          <Input
            id={name}
            type="text"
            value={(value as string) || ''}
            onChange={e => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder || 'bc1q... or 3... or 1...'}
            disabled={disabled}
            className={`font-mono text-sm ${baseInputClass}`}
          />
        );

      case 'tags':
        return (
          <Input
            id={name}
            type="text"
            value={Array.isArray(value) ? (value as string[]).join(', ') : (value as string) || ''}
            onChange={e => {
              const tags = e.target.value
                .split(',')
                .map(t => t.trim())
                .filter(Boolean);
              onChange(tags);
            }}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder || 'Enter tags separated by commas'}
            disabled={disabled}
            className={baseInputClass}
          />
        );

      case 'availability':
        return <AvailabilityEditor value={value} onChange={onChange} />;

      case 'image':
        return <ImageField value={value} onChange={onChange} label={label} disabled={disabled} />;

      case 'text':
      default:
        return (
          <Input
            id={name}
            type="text"
            value={(value as string) || ''}
            onChange={e => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={baseInputClass}
          />
        );
    }
  };

  // Checkbox has its own label handling
  if (type === 'checkbox') {
    return (
      <div>
        {renderInput()}
        {error && (
          <p role="alert" className="text-status-negative text-sm mt-1">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-fg-primary mb-2">
        {label}
        {required && <span className="text-status-negative ml-1">*</span>}
      </label>
      {renderInput()}
      {hint && !error && <p className="text-xs text-fg-secondary mt-1">{hint}</p>}
      {error && (
        <p role="alert" className="text-status-negative text-sm mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
