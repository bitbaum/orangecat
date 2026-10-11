/**
 * Header Constants
 *
 * Single source of truth for all header-related constants.
 * Prevents magic numbers and ensures consistency.
 *
 * Created: 2026-01-16
 */

/**
 * Header dimensions
 */
export const HEADER_DIMENSIONS = {
  /** Mobile height */
  HEIGHT_MOBILE: 'h-14',
  /** Desktop height */
  HEIGHT_DESKTOP: 'sm:h-16',
  /** Mobile height in pixels (for calculations) */
  HEIGHT_MOBILE_PX: 56,
  /** Desktop height in pixels (for calculations) */
  HEIGHT_DESKTOP_PX: 64,
} as const;

/**
 * Header spacing constants
 */
export const HEADER_SPACING = {
  /** Container padding */
  CONTAINER_PADDING: 'px-3 sm:px-4 md:px-6',
  /** Gap between items */
  ITEM_GAP: 'gap-2 sm:gap-3',
  /** Gap between icon action buttons. Tighter than ITEM_GAP (icon-only 44/40px
   *  targets) but growing with the breakpoint like it — the old 'gap-2.5 sm:gap-2'
   *  shrank on desktop, fighting the left cluster's rhythm and reading asymmetric. */
  ACTION_GAP: 'gap-1.5 sm:gap-2',
  /** Max width */
  MAX_WIDTH: 'max-w-7xl',
} as const;

/**
 * Header icon-button geometry (size, icon, radius, hover) now lives in the
 * HeaderIconButton primitive — see src/components/layout/HeaderIconButton.tsx.
 * Keep it there as the single source of truth; don't reintroduce per-button
 * class constants here.
 */

/**
 * Mobile menu constants
 */
export const MOBILE_MENU = {
  /** Menu width */
  WIDTH: 'w-80',
  /** Max width on small screens */
  MAX_WIDTH: 'max-w-[85vw] sm:max-w-sm',
  /** Position */
  POSITION: 'fixed top-16 bottom-0 left-0',
  BACKGROUND: 'bg-surface-base dark:bg-surface-page',
  /** Shadow */
  SHADOW: 'shadow-sm',
  /** Overflow */
  OVERFLOW: 'overflow-y-auto overscroll-contain',
  /** Transition */
  TRANSITION: 'transition-transform duration-300 ease-out',
} as const;
