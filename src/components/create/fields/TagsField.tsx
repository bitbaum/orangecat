'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
}

/**
 * Comma-separated tags, typed as text and stored as a list.
 *
 * The field used to parse on every keystroke and re-render the joined list,
 * so a comma or a trailing space vanished the moment it was typed — a second
 * tag, or any tag with a space in it, could not be typed at all (audit,
 * 2026-10-07). The raw text is kept while typing; the list is what the form
 * receives.
 */
export function TagsField({
  id,
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  disabled,
  className,
}: {
  id: string;
  value: unknown;
  onChange: (tags: string[]) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const external = Array.isArray(value) ? (value as string[]).join(', ') : String(value ?? '');
  const [raw, setRaw] = useState(external);
  // Values set from outside (AI fill, a template, a restored draft) replace the
  // text — but only when they differ from what this text already means.
  const [lastExternal, setLastExternal] = useState(external);
  if (external !== lastExternal) {
    setLastExternal(external);
    if (parseTags(raw).join(', ') !== external) {
      setRaw(external);
    }
  }

  return (
    <Input
      id={id}
      type="text"
      value={raw}
      onChange={e => {
        setRaw(e.target.value);
        onChange(parseTags(e.target.value));
      }}
      onFocus={onFocus}
      onBlur={() => {
        setRaw(parseTags(raw).join(', '));
        onBlur?.();
      }}
      // Enter in a text field submits the whole form; in a tag field it means
      // "next tag".
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (raw.trim() && !raw.trimEnd().endsWith(',')) {
            setRaw(`${raw.trimEnd()}, `);
          }
        }
      }}
      placeholder={placeholder || 'Separate tags with commas'}
      disabled={disabled}
      className={className}
    />
  );
}
