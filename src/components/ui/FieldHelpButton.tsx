'use client';

import { HelpCircle } from 'lucide-react';

/**
 * "Help with this field" on phones — shown while a field is focused, so the
 * soft keyboard is up. It was a 56px circle at bottom-6 right-6 in two places
 * (wallets, profile edit), one of them in Bitcoin Orange, floating over the
 * very form being typed into. Now one compact neutral pill, tucked into the
 * corner, the same everywhere.
 */
export function FieldHelpButton({ onClick, label = 'Help' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      // Keep focus in the field: a mousedown here would blur it, and the
      // button only exists while a field is focused.
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className="fixed bottom-3 right-3 z-50 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-default bg-surface-base px-3 text-sm font-medium text-fg-primary shadow-sm lg:hidden"
      aria-label="Get help with this field"
    >
      <HelpCircle className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
