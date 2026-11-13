'use client';

import { Globe, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIMELINE_SURFACE, TIMELINE_VISIBILITY_OPTIONS } from '@/config/timeline';
import type { TimelineVisibility } from '@/types/timeline';

interface ComposerVisibilityControlProps {
  simpleMode: boolean;
  visibility: TimelineVisibility;
  onChange: (visibility: TimelineVisibility) => void;
  disabled: boolean;
}

/**
 * Who can see the post: three chips in the simple composer, one icon toggle in
 * the full one.
 *
 * The chip group WRAPS and every chip keeps its label on one line. At 390px
 * the group used to be a non-wrapping row of three chips beside the AI and
 * image chips; it forced the composer's action row to 463px, so the page
 * scrolled sideways and only "Share" of "Share Update" was on screen.
 */
export default function ComposerVisibilityControl({
  simpleMode,
  visibility,
  onChange,
  disabled,
}: ComposerVisibilityControlProps) {
  if (!simpleMode) {
    return (
      <button
        type="button"
        onClick={() => onChange(visibility === 'public' ? 'private' : 'public')}
        disabled={disabled}
        className={TIMELINE_SURFACE.iconButton}
        title={visibility === 'public' ? 'Public - Everyone can see' : 'Private - Only you can see'}
        aria-label={`Post visibility: ${visibility}`}
      >
        {visibility === 'public' ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Who can see this post"
      className="flex min-w-0 flex-wrap items-center gap-2"
      data-testid="composer-visibility"
    >
      {TIMELINE_VISIBILITY_OPTIONS.map(preset => {
        const Icon = preset.Icon;
        const isActive = visibility === preset.key;
        return (
          <button
            key={preset.key}
            type="button"
            onClick={() => onChange(preset.key)}
            disabled={disabled}
            aria-pressed={isActive}
            className={cn(
              TIMELINE_SURFACE.chip,
              'min-h-9 whitespace-nowrap pointer-coarse:min-h-11',
              isActive && TIMELINE_SURFACE.chipActive
            )}
            title={preset.description}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
