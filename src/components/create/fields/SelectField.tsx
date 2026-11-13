'use client';

import type { SelectOption } from '../types';

/**
 * A native select with an empty "Select …" option, and the chosen option's
 * description shown beneath it.
 */
export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  onFocus,
  onBlur,
  disabled,
  className,
}: {
  id: string;
  label: string;
  value: unknown;
  options?: SelectOption[] | readonly SelectOption[];
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  className: string;
}) {
  // The chosen option's meaning, where the choice is made — not in a
  // guidance panel a screen away.
  const chosen = options?.find(o => o.value === value)?.description;
  return (
    <>
      <select
        id={id}
        value={(value as string) || ''}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:border-interactive transition-colors ${className} ${
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
