'use client';

import { Trash2, Eye, EyeOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Z_INDEX_CLASSES } from '@/constants/z-index';
import { useMobileActionBar } from '@/hooks/useMobileActionBar';

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
  entityNamePlural?: string;
  additionalInfo?: React.ReactNode;
  className?: string;
  /** Callback to show selected items on profile */
  onShowOnProfile?: () => void;
  /** Callback to hide selected items from profile */
  onHideFromProfile?: () => void;
  /** Whether visibility update is in progress */
  isUpdatingVisibility?: boolean;
}

/**
 * BulkActionsBar - Reusable bulk actions component for entity list pages
 *
 * Displays a fixed bottom bar when items are selected, allowing bulk operations.
 * Used across all entity list pages (services, products, assets, etc.)
 */
export default function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onDelete,
  isDeleting = false,
  entityNamePlural = 'items',
  additionalInfo,
  className,
  onShowOnProfile,
  onHideFromProfile,
  isUpdatingVisibility = false,
}: BulkActionsBarProps) {
  useMobileActionBar(selectedCount > 0);
  if (selectedCount === 0) {
    return null;
  }

  const isDisabled = isDeleting || isUpdatingVisibility;

  return (
    <div
      className={cn(
        // Above the mobile bottom nav on mobile; on >=md the mobile nav
        // is hidden so positioning is irrelevant. Z + clearance pulled
        // from the design SSOT (.oc-above-mobile-nav + MOBILE_ACTION_BAR).
        'fixed inset-x-0 md:bottom-0 border-t border-default bg-surface-base shadow-none oc-above-mobile-nav',
        Z_INDEX_CLASSES.MOBILE_ACTION_BAR,
        // On phones .oc-above-mobile-nav already clears the home indicator
        // (it sits on top of the nav); padding for it again made the bar a
        // home-indicator taller than it needed to be. On md+ the bar is the
        // bottom edge itself, so the inset belongs there.
        'md:pb-[max(1rem,env(safe-area-inset-bottom))]',
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <span className="text-sm font-medium text-fg-primary whitespace-nowrap">
              {selectedCount} {entityNamePlural} selected
            </span>
            {additionalInfo && <div className="flex-1 min-w-0">{additionalInfo}</div>}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 flex-wrap justify-end">
            <button
              onClick={onClearSelection}
              className="text-sm text-fg-secondary hover:text-fg-primary transition-colors whitespace-nowrap"
              disabled={isDisabled}
            >
              Clear
            </button>
            {/* Visibility Actions */}
            {(onShowOnProfile || onHideFromProfile) && (
              <>
                {onShowOnProfile && (
                  <Button
                    onClick={onShowOnProfile}
                    variant="secondary"
                    size="sm"
                    disabled={isDisabled}
                    className="hidden sm:flex"
                  >
                    <Eye className="w-4 h-4 mr-1.5" />
                    {isUpdatingVisibility ? 'Updating...' : 'Show on Profile'}
                  </Button>
                )}
                {onHideFromProfile && (
                  <Button
                    onClick={onHideFromProfile}
                    variant="secondary"
                    size="sm"
                    disabled={isDisabled}
                    className="hidden sm:flex"
                  >
                    <EyeOff className="w-4 h-4 mr-1.5" />
                    {isUpdatingVisibility ? 'Updating...' : 'Hide from Profile'}
                  </Button>
                )}
              </>
            )}
            {/* Delete Action */}
            <Button onClick={onDelete} variant="danger" disabled={isDisabled}>
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
