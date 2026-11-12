'use client';

/**
 * SettingsAppearanceSection — the explicit theme choice.
 *
 * The header button and the account-dropdown row both cycle in one tap, which
 * is the right cost for a preference you flip; this is the surface where you
 * pick a mode directly and read what each one means. All three render from
 * THEME_MODES and write through useThemeMode, so there is one option list and
 * one save path, not three.
 */

import { Palette, Check } from 'lucide-react';
import { THEME_MODES } from '@/config/theme';
import { useThemeMode } from '@/hooks/useThemeMode';
import { cn } from '@/lib/utils';

export function SettingsAppearanceSection() {
  const { mode, setMode, mounted } = useThemeMode();

  return (
    <div className="border-t border-subtle pt-10">
      <h3 className="mb-4 flex items-center text-lg font-semibold text-fg-primary">
        <Palette className="mr-2 h-6 w-6 text-fg-secondary" />
        Appearance
      </h3>
      <p className="mb-6 text-fg-secondary">
        Choose how OrangeCat looks. Your choice follows you to any device you sign in on.
      </p>
      <div role="radiogroup" aria-label="Theme" className="grid max-w-2xl gap-3 sm:grid-cols-3">
        {THEME_MODES.map(({ value, label, description, icon: Icon }) => {
          const active = mounted && mode === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!mounted}
              onClick={() => setMode(value)}
              className={cn(
                'flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:opacity-50',
                active
                  ? 'border-accent-primary bg-accent-primary/5'
                  : 'border-default hover:border-interactive hover:bg-surface-raised'
              )}
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-fg-secondary" />
                {active && <Check className="h-4 w-4 text-accent-warm" />}
              </div>
              <span className="font-medium text-fg-primary">{label}</span>
              <span className="text-sm text-fg-secondary">{description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
