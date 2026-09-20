'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useBottomNavScroll } from '@/hooks/useHeaderScroll';
import { useComposer } from '@/contexts/ComposerContext';
import { cn } from '@/lib/utils';
import { getRouteChrome, getRouteSurface, ROUTES } from '@/config/routes';
import { getContextualCreateAction } from '@/lib/navigation/contextual-create';
import { isNavHrefActive } from '@/lib/navigation/isActive';
import { mobileTabBar, mobileTabBarAnonymous } from '@/config/navigation';
import { MobileCreateSheet } from '@/components/create/MobileCreateSheet';
import { Z_INDEX } from '@/constants/z-index';

// When the iOS/Android software keyboard opens, the visual viewport
// height shrinks below the layout viewport height. The bottom nav is
// position:fixed so it stays "at the bottom" of the LAYOUT viewport —
// which means it sits underneath the keyboard, hiding any input the
// user is actually typing into. Detect the shrink and hide the nav
// while the keyboard is up.
const KEYBOARD_HEIGHT_THRESHOLD_PX = 150;

const MobileBottomNav = React.memo(function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, hydrated } = useAuth();
  const { isCompact } = useBottomNavScroll();
  const { openComposer } = useComposer();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) {
      return;
    }
    const onResize = () => {
      // Difference between layout viewport and visual viewport — when
      // the keyboard rises, vv.height shrinks but window.innerHeight
      // stays the same. The 150px threshold filters out URL-bar
      // show/hide on mobile Safari, which is also a viewport shrink
      // but not a keyboard.
      setKeyboardOpen(window.innerHeight - vv.height > KEYBOARD_HEIGHT_THRESHOLD_PX);
    };
    vv.addEventListener('resize', onResize);
    onResize();
    return () => {
      vv.removeEventListener('resize', onResize);
    };
  }, []);

  // Don't render until auth is hydrated to prevent layout shift
  if (!hydrated) {
    return null;
  }

  // Don't render if no pathname
  if (!pathname) {
    return null;
  }

  // SSOT: bottom nav appears wherever the desktop sidebar would (every
  // in-app surface). Mirrors AppShell's `isAppSurface` rule.
  if (getRouteSurface(pathname) !== 'app') {
    return null;
  }

  if (getRouteChrome(pathname).hideMobileBottomNav) {
    return null;
  }

  // Hide while the soft keyboard is up so it doesn't cover the input
  // the user is typing into.
  if (keyboardOpen) {
    return null;
  }

  // Get contextual create action for the "+" button
  const createAction = getContextualCreateAction(pathname);

  // Authenticated users ALWAYS see the same 5 items for consistency
  // Non-authenticated users see simplified nav
  const isAuthenticated = !!user;

  // Active state uses isNavHrefActive — the same SSOT as sidebar + desktop
  // header nav, so a route reads as "active" identically across all three
  // chrome surfaces.
  const isActiveHref = (href: string) => isNavHrefActive(pathname, href);

  // SSOT: the slot list lives in src/config/navigation.ts alongside the sidebar,
  // so "what deserves a thumb" is one decision in one file rather than a second
  // list here that quietly drifts from the rest of the chrome.
  const navItems = isAuthenticated ? mobileTabBar : mobileTabBarAnonymous;

  const handleCreate = () => {
    if (createAction.type === 'post') {
      openComposer();
      router.push(`${ROUTES.TIMELINE}?compose=true`);
    } else if (createAction.type === 'entity') {
      router.push(createAction.href);
    } else {
      setShowCreateSheet(true);
    }
  };

  return (
    <>
      <div
        className={cn(
          'md:hidden fixed bottom-0 left-0 right-0 border-t border-default',
          'transition-all duration-300 ease-in-out',
          // OPAQUE, always. `bg-surface-page/95` let page content read through
          // the nav on a light background; primary navigation has to be a
          // surface, not a filter.
          'bg-surface-page',
          isAuthenticated && 'shadow-sm'
        )}
        style={{
          zIndex: Z_INDEX.MOBILE_BOTTOM_NAV,
          // SSOT for nav-vs-home-indicator clearance lives on this outer container.
          // Inner <nav> uses a fixed interior padding so we don't double up.
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Primary button spacer - creates space above nav for floating button */}
        <div
          className={cn('transition-all duration-300', isCompact ? 'h-1' : 'h-2')}
          aria-hidden="true"
        />

        <nav
          className={cn(
            'flex items-center justify-around transition-all duration-300 pb-2',
            isCompact ? 'px-1 py-1' : 'px-2 py-2'
          )}
          style={{
            minHeight: isCompact ? '56px' : '64px',
          }}
          role="navigation"
          aria-label="Mobile navigation"
        >
          {navItems.map((item, index) => {
            const Icon = item.icon;
            // Profile collapsed /profile + /profiles; nothing in the bar needs
            // that special case now, so every slot uses the shared active test.
            const isActive = isActiveHref(item.href);
            const label = item.opensCreate ? createAction.label : item.name;

            return (
              <button
                key={`${item.href}-${index}`}
                onClick={e => {
                  e.preventDefault();
                  if (item.opensCreate) {
                    handleCreate();
                  } else {
                    router.push(item.href);
                  }
                }}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 rounded-lg',
                  'transition-all duration-200',
                  'touch-manipulation select-none',
                  '-webkit-tap-highlight-color-transparent',
                  'active:scale-95 active:bg-surface-raised dark:active:bg-surface-raised',
                  isActive && 'text-fg-primary',
                  !isActive && 'text-fg-secondary',
                  item.primary && 'relative',
                  isCompact ? 'min-h-12 gap-0.5' : 'min-h-14 gap-1'
                )}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                type="button"
              >
                {item.primary ? (
                  // LABELLED, like every other slot. It rendered as a bare
                  // black circle holding a QR glyph — no text, its only
                  // accessible name on the aria-label — so the most prominent
                  // control in the bar was the one nobody could name. "Receive"
                  // is not guessable from a QR icon.
                  <>
                    <div
                      className={cn(
                        'absolute flex items-center justify-center rounded-full shadow-sm',
                        'transition-all duration-300 hover:scale-105 active:scale-95',
                        'bg-fg-primary'
                      )}
                      style={{
                        width: isCompact ? '44px' : '48px',
                        height: isCompact ? '44px' : '48px',
                        top: isCompact ? '-16px' : '-18px',
                      }}
                      aria-hidden="true"
                    >
                      <Icon
                        className={cn(
                          'text-fg-inverted transition-all duration-300',
                          isCompact ? 'w-5 h-5' : 'w-6 h-6'
                        )}
                        strokeWidth={2}
                      />
                    </div>
                    <span
                      className={cn(
                        'mt-auto font-medium leading-tight transition-all duration-300',
                        isCompact ? 'text-2xs' : 'text-xs',
                        isActive ? 'font-semibold text-fg-primary' : 'text-fg-secondary'
                      )}
                    >
                      {label}
                    </span>
                  </>
                ) : (
                  <>
                    <Icon
                      className={cn(
                        'transition-all duration-300',
                        isCompact ? 'w-5 h-5' : 'w-6 h-6',
                        isActive && 'fill-current scale-110'
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span
                      className={cn(
                        'font-medium transition-all duration-300 leading-tight',
                        isCompact ? 'text-2xs' : 'text-xs',
                        isActive && 'font-semibold'
                      )}
                    >
                      {label}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mobile Create Sheet - shown when "+" triggers menu action */}
      <MobileCreateSheet isOpen={showCreateSheet} onClose={() => setShowCreateSheet(false)} />
    </>
  );
});

MobileBottomNav.displayName = 'MobileBottomNav';

export default MobileBottomNav;
