/**
 * Header UI Utilities
 *
 * Utilities for header styling and behavior.
 * Follows DRY principle - extracted from Header component.
 *
 * Created: 2026-01-16
 */

import { cn } from '@/lib/utils';
import { Z_INDEX_CLASSES } from '@/constants/z-index';

/**
 * Get header classes based on scroll state
 *
 * @param isScrolled - Whether page is scrolled
 * @param isHidden - Whether header should be hidden
 * @param className - Additional classes
 * @returns Combined class string
 */
export function getHeaderClasses(
  isScrolled: boolean,
  isHidden: boolean,
  className?: string
): string {
  return cn(
    'fixed top-0 left-0 right-0 transition-all duration-200',
    Z_INDEX_CLASSES.HEADER,
    isScrolled
      ? 'bg-surface-page/95 backdrop-blur-xl shadow-sm border-b border-default'
      : 'bg-surface-page/95 backdrop-blur-lg border-b border-default',
    // Hidden on scroll-down, but never while keyboard focus is inside it: past
    // the last control on a page, Tab wraps to the header's own controls, and
    // they took focus off-screen at y=-51 (WCAG 2.4.11).
    isHidden ? '-translate-y-full has-focus-visible:translate-y-0' : 'translate-y-0',
    className
  );
}

/**
 * Get mobile menu backdrop classes
 *
 * @param isOpen - Whether menu is open
 * @returns Backdrop class string
 */
export function getMobileMenuBackdropClasses(isOpen: boolean): string {
  return cn(
    'fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
    Z_INDEX_CLASSES.MOBILE_MENU_BACKDROP,
    isOpen ? 'opacity-100' : 'opacity-0'
  );
}

/**
 * Get mobile menu panel classes
 *
 * @param isOpen - Whether menu is open
 * @returns Menu panel class string
 */
export function getMobileMenuPanelClasses(isOpen: boolean): string {
  return cn(
    'fixed top-16 bottom-0 left-0 flex w-80 max-w-[85vw] flex-col sm:max-w-sm bg-surface-base shadow-sm transition-transform duration-300 ease-out',
    Z_INDEX_CLASSES.MOBILE_MENU,
    isOpen ? 'translate-x-0' : '-translate-x-full'
  );
}
