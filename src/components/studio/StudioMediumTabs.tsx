'use client';

import { cn } from '@/lib/utils';
import { STUDIO_MEDIUMS, STUDIO_MEDIA, type StudioMedium } from '@/config/studio';
import type { StudioMediumAccess } from '@/services/studio/client';

/**
 * One tab per medium. Unavailable mediums are still shown and still clickable
 * — the panel behind them explains which key unlocks them, which is more use
 * than a tab that is missing for a reason the user cannot see.
 */
export default function StudioMediumTabs({
  medium,
  onSelect,
  capability,
}: {
  medium: StudioMedium;
  onSelect: (next: StudioMedium) => void;
  capability: StudioMediumAccess[] | null;
}) {
  return (
    <div
      role="tablist"
      aria-label="What to make"
      className="flex flex-wrap gap-2 border-b border-default pb-3"
    >
      {STUDIO_MEDIUMS.map(id => {
        const meta = STUDIO_MEDIA[id];
        const Icon = meta.icon;
        const access = capability?.find(entry => entry.medium === id);
        const selected = id === medium;
        return (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onSelect(id)}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              selected
                ? 'border-interactive bg-surface-raised text-fg-primary'
                : 'border-default text-fg-secondary hover:text-fg-primary'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {meta.name}
            {capability && access && !access.available && (
              <span className="rounded-full border border-default px-1.5 py-0.5 text-2xs text-fg-tertiary">
                key needed
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
