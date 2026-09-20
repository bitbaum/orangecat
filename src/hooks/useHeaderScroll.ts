/**
 * Shared hook for header scroll behavior
 *
 * Handles:
 * - Scroll detection for backdrop blur
 * - Hide/show on scroll down/up
 *
 * Created: 2025-01-07
 * Last Modified: 2026-09-20
 * Last Modified Summary: Bottom-nav transparency removed — see useBottomNavScroll
 */

import { useState, useEffect, useRef } from 'react';

interface UseHeaderScrollOptions {
  hideOnScrollDown?: boolean;
  scrollThreshold?: number;
}

interface UseHeaderScrollReturn {
  isScrolled: boolean;
  isHidden: boolean;
}

export function useHeaderScroll(options: UseHeaderScrollOptions = {}): UseHeaderScrollReturn {
  const { hideOnScrollDown = true, scrollThreshold = 80 } = options;
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollRef = useRef<number>(0);
  const tickingRef = useRef<boolean>(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const minScrollDelta = 16; // Minimum scroll delta to prevent flickering from tiny movements and layout shifts

  useEffect(() => {
    const handleScroll = () => {
      if (!tickingRef.current) {
        window.requestAnimationFrame(() => {
          const current = window.scrollY;
          const scrollDelta = Math.abs(current - lastScrollRef.current);

          setIsScrolled(current > 0);

          // When near the top, always show the header and clear pending hides
          if (current <= scrollThreshold) {
            if (hideTimeoutRef.current) {
              clearTimeout(hideTimeoutRef.current);
              hideTimeoutRef.current = null;
            }
            setIsHidden(false);
          }

          if (hideOnScrollDown) {
            // Only process if scroll delta is significant enough to prevent flickering
            if (scrollDelta >= minScrollDelta) {
              const isScrollingDown = current > lastScrollRef.current && current > scrollThreshold;
              const isScrollingUp = current < lastScrollRef.current;

              // Clear any pending hide timeout
              if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current);
                hideTimeoutRef.current = null;
              }

              if (isScrollingDown) {
                // Add small delay before hiding to prevent flickering
                hideTimeoutRef.current = setTimeout(() => {
                  setIsHidden(true);
                }, 100);
              } else if (isScrollingUp) {
                // Show immediately when scrolling up
                setIsHidden(false);
              }
            }
          }

          lastScrollRef.current = current;
          tickingRef.current = false;
        });

        tickingRef.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [hideOnScrollDown, scrollThreshold]);

  return { isScrolled, isHidden };
}

/**
 * Bottom-nav density on scroll.
 *
 * This used to also return `shouldBeTransparent`, and the nav rendered it as
 * `bg-surface-page/20` + `opacity: 0.7` + `transform: scale(0.85)`. Past 50px
 * the flag latched on and never cleared until you scrolled back to the very
 * top — so for the whole length of a normal page the app's primary navigation
 * was a translucent, shrunken ghost with the page text legible THROUGH it, and
 * buttons at the bottom of the content ("Top up", "Add API Key") sitting
 * half-buried under it.
 *
 * Two separate mistakes, both removed:
 *
 *   - Transparency. Primary navigation is not decoration; it does not get to
 *     be unreadable to look modern.
 *   - `scale()`. A transform does not change layout, so the space the page
 *     reserves below its content no longer matched the nav's apparent size,
 *     and it silently shrank the touch targets below 44px.
 *
 * What survives is the part that was actually useful: a COMPACT mode that
 * gives a little height back to the content while you read, done by changing
 * real height, and legible throughout.
 */
interface UseBottomNavScrollOptions {
  /** Scroll depth, in px, past which the nav goes compact. */
  compactThreshold?: number;
}

interface UseBottomNavScrollReturn {
  isCompact: boolean;
}

export function useBottomNavScroll(
  options: UseBottomNavScrollOptions = {}
): UseBottomNavScrollReturn {
  const { compactThreshold = 50 } = options;
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsCompact(window.scrollY > compactThreshold);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [compactThreshold]);

  return { isCompact };
}
