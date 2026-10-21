'use client';

/**
 * "Add a note" — closed until wanted, and the same on every money screen.
 *
 * Send and Request each wrapped the note in a <details> whose summary looked
 * like a button and read like a label ("Note (optional)"). One shape now: a
 * text button that says what it does, and the field once it is wanted.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/Input';

interface OptionalNoteFieldProps {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  /** What a note is for here: "What's it for?" */
  placeholder: string;
  label?: string;
  addLabel?: string;
}

export function OptionalNoteField({
  value,
  onChange,
  maxLength,
  placeholder,
  label = 'Note',
  addLabel = 'Add a note',
}: OptionalNoteFieldProps) {
  const [open, setOpen] = useState(value.length > 0);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 items-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {addLabel}
      </button>
    );
  }

  return (
    <Input
      label={label}
      value={value}
      onChange={e => onChange(e.target.value.slice(0, maxLength))}
      placeholder={placeholder}
      className="min-h-11"
      autoFocus
    />
  );
}
