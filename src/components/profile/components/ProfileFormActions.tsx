/**
 * Profile Form Actions — Cancel and Save profile.
 *
 * On the edit page the form is long, and Save sat at its very end: thousands
 * of pixels down on a phone, and not pinned. The inline bar now sticks above
 * the mobile tab bar (the MoneyActionBar pattern) and settles into place from
 * lg up; two equal cells, both 44px, Save the one primary action.
 */

'use client';

import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface ProfileFormActionsProps {
  isSaving: boolean;
  isValid: boolean;
  onCancel: () => void;
  variant?: 'inline' | 'modal';
}

export function ProfileFormActions({
  isSaving,
  isValid,
  onCancel,
  variant = 'inline',
}: ProfileFormActionsProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 border-t border-default',
        variant === 'inline'
          ? 'sticky bottom-[var(--mobile-nav-clearance)] z-10 -mx-3 rounded-b-lg bg-surface-page/95 px-3 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:bg-surface-base lg:backdrop-blur-none'
          : 'pt-4'
      )}
    >
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isSaving}
        className="min-h-11"
      >
        Cancel
      </Button>
      <Button type="submit" variant="primary" disabled={isSaving || !isValid} className="min-h-11">
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save profile
          </>
        )}
      </Button>
    </div>
  );
}
