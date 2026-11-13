/**
 * useMediaQuery Hook
 *
 * React hook for responsive media queries that works with SSR
 * Prevents hydration mismatches by not accessing window during SSR
 *
 * Usage:
 * ```tsx
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 * const isMobile = useMediaQuery('(max-width: 767px)');
 * ```
 *
 * Created: 2026-01-16
 */

'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to check if a media query matches
 *
 * SSR-safe: Returns false during SSR, updates after hydration
 * Reactive: Automatically updates when window is resized
 *
 * @param query - CSS media query string (e.g., '(min-width: 1024px)')
 * @returns boolean indicating if the media query matches
 *
 * @example
 * ```tsx
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 * const isMobile = useMediaQuery('(max-width: 767px)');
 * const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
 * ```
 */
export function useMediaQuery(query: string): boolean {
  // Start with false to match SSR behavior
  // This prevents hydration mismatch
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Only run on client side (and where the API exists — jsdom has none)
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    // Create media query list
    const media = window.matchMedia(query);

    // Set initial value based on current match
    setMatches(media.matches);

    // Create listener for changes
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern API (preferred)
    if (media.addEventListener) {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    } else {
      // Legacy API (fallback for older browsers). addListener/removeListener are
      // deprecated but still typed in lib.dom — no cast or suppression needed.
      media.addListener(listener);
      return () => media.removeListener(listener);
    }
  }, [query]);

  return matches;
}

export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)');
}
