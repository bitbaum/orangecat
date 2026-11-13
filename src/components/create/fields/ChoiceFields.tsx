'use client';

import type { SelectOption } from '../types';

/**
 * Radios and checkboxes: 20px, drawn in ink rather than the browser's blue
 * (accent-color is the one thing a native control takes from the page).
 * They were 13px natives with no accent.
 */
export const CHOICE_INPUT = 'mt-0.5 h-5 w-5 shrink-0 accent-fg-primary focus:ring-ring';

/** One radio per option, each with its label and optional description. */
export function RadioGroupField({
  name,
  value,
  options,
  onChange,
  onFocus,
  disabled,
}: {
  name: string;
  value: unknown;
  options?: SelectOption[] | readonly SelectOption[];
  onChange: (value: string) => void;
  onFocus?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {options?.map(option => (
        <label key={option.value} className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={e => onChange(e.target.value)}
            onFocus={onFocus}
            disabled={disabled}
            className={CHOICE_INPUT}
          />
          <div>
            <span className="text-sm font-medium text-fg-primary">{option.label}</span>
            {option.description && (
              <p className="mb-0 text-xs text-fg-secondary">{option.description}</p>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}

/** A single checkbox that carries its own label text. */
export function CheckboxField({
  id,
  checked,
  text,
  onChange,
  onFocus,
  disabled,
}: {
  id: string;
  checked: boolean;
  text: string;
  onChange: (checked: boolean) => void;
  onFocus?: () => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        onFocus={onFocus}
        disabled={disabled}
        className={CHOICE_INPUT}
      />
      <span className="text-sm text-fg-primary">{text}</span>
    </label>
  );
}
