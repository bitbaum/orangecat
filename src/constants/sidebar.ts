/**
 * Sidebar constants
 *
 * Centralized constants for sidebar dimensions, z-indexes, and other magic numbers
 *
 * Created: 2025-01-07
 * Last Modified: 2025-01-07
 * Last Modified Summary: Created sidebar constants file
 */

/**
 * Z-index constants for sidebar and related elements
 */
export const SIDEBAR_Z_INDEX = {
  SIDEBAR: 'z-40',
  OVERLAY: 'z-40',
  TOOLTIP: 'z-50', // Tooltips appear above sidebar but below header
  FLYOUT_TOOLTIP: 60, // Flyout tooltips need higher z-index
  HEADER: 'z-50',
  HEADER_VALUE: 50,
  SIDEBAR_VALUE: 40,
} as const;

/**
 * Sidebar transition durations
 */
export const SIDEBAR_TRANSITIONS = {
  DURATION: 'duration-300',
  EASING: 'ease-in-out',
  DURATION_MS: 300,
} as const;

/**
 * Sidebar spacing constants
 */
export const SIDEBAR_SPACING = {
  PADDING_X: 'px-2',
  PADDING_Y: 'py-3 sm:py-4',
  ITEM_HEIGHT: 'min-h-11', // Touch-friendly minimum height
  SECTION_SPACING: 'space-y-4 sm:space-y-6',
} as const;

/**
 * Sidebar colors
 */
export const SIDEBAR_COLORS = {
  BACKGROUND: 'bg-surface-page',
  BORDER: 'border-subtle',
  ACTIVE_BACKGROUND: 'bg-surface-overlay',
  ACTIVE_TEXT: 'text-fg-primary',
  ACTIVE_BORDER: 'border-subtle',
  HOVER_BACKGROUND: 'hover:bg-surface-overlay',
  TEXT_PRIMARY: 'text-fg-primary',
  TEXT_SECONDARY: 'text-fg-secondary',
} as const;
