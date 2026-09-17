'use client';

/**
 * "May Cat bring things up on its own?"
 *
 * The switch behind `user_ai_preferences.proactive_suggestions_enabled`. It is
 * on by default, so this control exists to be found by the person it is
 * annoying — which is why the copy says plainly what Cat does with it rather
 * than selling the feature.
 */

import { Lightbulb } from 'lucide-react';
import { useState } from 'react';

interface CatProactivityToggleProps {
  enabled: boolean;
  isLoading?: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
}

export function CatProactivityToggle({
  enabled,
  isLoading = false,
  onToggle,
}: CatProactivityToggleProps) {
  const [saving, setSaving] = useState(false);

  const handleToggle = async () => {
    if (saving || isLoading) {
      return;
    }
    setSaving(true);
    try {
      await onToggle(!enabled);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-subtle bg-surface-raised/30 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-fg-tertiary" aria-hidden />
          <div>
            <h3 className="text-sm font-medium text-fg-primary">Let Cat bring things up</h3>
            <p className="mt-1 text-sm text-fg-secondary">
              Cat can mention something you didn&apos;t ask about — a draft nobody can find yet, or
              something nobody can pay into. One at a time, at the end of a reply, and never twice.
              Turn this off and Cat only answers what you ask.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Let Cat bring things up"
          disabled={saving || isLoading}
          onClick={handleToggle}
          className={[
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
            'focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            enabled ? 'bg-accent-primary' : 'bg-border-default',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-4 w-4 transform rounded-full bg-surface-base transition-transform',
              enabled ? 'translate-x-6' : 'translate-x-1',
            ].join(' ')}
          />
        </button>
      </div>
    </div>
  );
}
