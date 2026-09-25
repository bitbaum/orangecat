'use client';

/**
 * AUTONOMY SELECT — the per-action trust ladder (Off / Ask first / Automatic).
 *
 * A binary on/off switch could not express the difference that actually
 * matters to users: "Cat may do this, but check with me" vs "just do it".
 * High-risk actions (money) never offer Automatic — see allowedLevelsForRisk.
 *
 * Segmented control on desktop; the same buttons wrap and stay ≥44px tall on
 * narrow screens, so it stays tappable without a separate mobile component.
 */

import { cn } from '@/lib/utils';
import {
  AUTONOMY_LEVEL_META,
  allowedLevelsForRisk,
  type AutonomyLevel,
} from '@/config/cat-autonomy';
import type { ActionRiskLevel } from '@/config/cat-actions';

interface AutonomySelectProps {
  value: AutonomyLevel;
  riskLevel: ActionRiskLevel;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (level: AutonomyLevel) => void;
}

export function AutonomySelect({
  value,
  riskLevel,
  disabled,
  ariaLabel,
  onChange,
}: AutonomySelectProps) {
  const levels = allowedLevelsForRisk(riskLevel);

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-1 rounded-md border border-subtle bg-surface-raised p-1"
    >
      {levels.map(level => {
        const meta = AUTONOMY_LEVEL_META[level];
        const selected = value === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            title={meta.description}
            onClick={() => !selected && onChange(level)}
            className={cn(
              'min-h-11 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-8',
              selected
                ? 'bg-fg-primary text-surface-base'
                : 'text-fg-secondary hover:bg-surface-base hover:text-fg-primary',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
