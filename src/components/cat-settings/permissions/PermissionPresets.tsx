'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  PERMISSION_PRESET_META,
  PERMISSION_PRESET_ORDER,
  type PermissionPreset,
} from '@/config/cat-autonomy';

interface PermissionPresetsProps {
  saving: string | null;
  /** The preset the current choices match; null when they are a custom mix. */
  active: PermissionPreset | null;
  onApplyPreset: (preset: PermissionPreset) => void | Promise<void>;
}

/**
 * Four presets as one pick-one group of equal cells. A preset replaces every
 * individual choice, so picking a different one asks first; the one the
 * current choices match is marked, and a mix of choices reads "Custom".
 */
export function PermissionPresets({ saving, active, onApplyPreset }: PermissionPresetsProps) {
  const [pending, setPending] = useState<PermissionPreset | null>(null);
  const pendingLabel = pending ? PERMISSION_PRESET_META[pending].label : '';

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="cat-presets-heading" className="text-base font-semibold text-fg-primary">
          Start from a preset
        </h3>
        {active === null && <span className="text-sm text-fg-secondary">Custom</span>}
      </div>
      <div
        role="radiogroup"
        aria-labelledby="cat-presets-heading"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {PERMISSION_PRESET_ORDER.map(preset => {
          const meta = PERMISSION_PRESET_META[preset];
          const checked = active === preset;
          return (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={saving !== null}
              onClick={() => {
                if (!checked) {
                  setPending(preset);
                }
              }}
              className={`flex min-h-11 flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors disabled:opacity-50 ${
                checked
                  ? 'border-fg-primary bg-surface-raised'
                  : 'border-subtle hover:border-strong hover:bg-surface-raised'
              }`}
            >
              <span className="font-medium text-fg-primary">{meta.label}</span>
              <span className="text-sm text-fg-secondary">{meta.description}</span>
            </button>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          const preset = pending;
          setPending(null);
          if (preset) {
            await onApplyPreset(preset);
          }
        }}
        title={`Switch to ${pendingLabel}?`}
        description="This replaces your individual choices."
        confirmLabel={`Switch to ${pendingLabel}`}
        isLoading={saving === 'preset'}
      />
    </div>
  );
}
