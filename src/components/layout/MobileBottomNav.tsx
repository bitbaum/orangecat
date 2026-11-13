'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useShellPathname } from '@/hooks/useShellPathname';
import { useBottomNavScroll } from '@/hooks/useHeaderScroll';
import { cn } from '@/lib/utils';
import { getRouteChrome, getRouteSurface } from '@/config/routes';
import { getContextualCreateType } from '@/lib/navigation/contextual-create';
import { isNavHrefActive } from '@/lib/navigation/isActive';
import { mobileTabBar, mobileTabBarAnonymous } from '@/config/navigation';
import { MobileCreateSheet } from '@/components/create/MobileCreateSheet';
import { NotificationBadge } from '@/components/ui/NotificationBadge';
import { Z_INDEX } from '@/constants/z-index';
import { useSoftKeyboard } from '@/hooks/useSoftKeyboard';
import { useUnreadCount } from '@/stores/messaging';

// The nav is position:fixed to the bottom, so while the soft keyboard is up
// it sits right where the field being typed into scrolls to. It hides then —
// see useSoftKeyboard for why the old viewport comparison never fired on
// Android.

const MobileBottomNav = React.memo(function MobileBottomNav() {
  const pathname = useShellPathname();
  const router = useRouter();
  const { user, hydrated } = useAuth();
  const { isCompact } = useBottomNavScroll();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  // Shared with the floating Cat button: both step aside while typing.
  const keyboardOpen = useSoftKeyboard();
  // Same number the header and sidebar badges show. Below md the header's
  // Messages button is hidden in favour of this tab, so this is the only place
  // a phone shows it.
  const unreadMessages = useUnreadCount();

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

  // The kind this page is about goes first inside the Create sheet.
  const suggestedCreateType = getContextualCreateType(pathname);

  // Authenticated users ALWAYS see the same 5 items for consistency
  // Non-authenticated users see simplified nav
  const isAuthenticated = !!user;

  // Active state uses isNavHrefActive — the same SSOT as sidebar + desktop
  // header nav, so a route reads as "active" identically across all three
  // chrome surfaces.
  const isActiveHref = (href: string, activeFor?: readonly string[]) =>
    isNavHrefActive(pathname, href, activeFor);

  // SSOT: the slot list lives in src/config/navigation.ts alongside the sidebar,
  // so "what deserves a thumb" is one decision in one file rather than a second
  // list here that quietly drifts from the rest of the chrome.
  const navItems = isAuthenticated ? mobileTabBar : mobileTabBarAnonymous;

  // One name, one behaviour, on every page: the plus opens the sheet.
  const handleCreate = () => setShowCreateSheet(true);

  return (
    <>
      <div
        data-fc-avoid=""
        className={cn(
          // app-mobile-nav: globals.css keeps keyboard focus scrolled clear of
          // this bar while it is on the page (scroll-padding-bottom).
          'app-mobile-nav md:hidden fixed bottom-0 left-0 right-0 border-t border-default',
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
            const isActive = isActiveHref(item.href, item.activeFor);
            const label = item.name;
            const count = item.counter === 'messages' ? unreadMessages : 0;
            // Worded like the header's Messages button, so a screen reader
            // hears the count from either.
            const accessibleName = count > 0 ? `${label} (${count} unread)` : label;

            return (
              <button
                key={`${item.href}-${index}`}
                ref={item.opensCreate ? createTriggerRef : undefined}
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
                aria-label={accessibleName}
                aria-current={isActive ? 'page' : undefined}
                type="button"
              >
                {item.primary ? (
                  // LABELLED, like every other slot. It rendered as a bare
                  // black circle holding a QR glyph — no text, its only
                  // accessible name on the aria-label — so the most prominent
                  // control in the bar was the one nobody could name. "Money"
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
                    {/* The circle is lifted out of flow, so this stands in for
                        the icon every other slot stacks above its label. With
                        the label pushed to the bottom instead (`mt-auto`) it
                        sat 6px below its neighbours (production, 2026-11-12). */}
                    <span
                      className={cn('shrink-0', isCompact ? 'h-5 w-5' : 'h-6 w-6')}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        'font-medium leading-tight transition-all duration-300',
                        isCompact ? 'text-2xs' : 'text-xs',
                        isActive ? 'font-semibold text-fg-primary' : 'text-fg-secondary'
                      )}
                    >
                      {label}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="relative inline-flex">
                      <Icon
                        className={cn(
                          'transition-all duration-300',
                          isCompact ? 'w-5 h-5' : 'w-6 h-6',
                          // Never `fill-current`: these are stroke icons, and a
                          // fill in the stroke's colour swallows every inner
                          // line. The active Explore tab showed a blank white
                          // disc instead of a compass (production, 2026-11-12).
                          isActive && 'scale-110'
                        )}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      {/* The header's badge, centred on the icon's corner as it
                          is there. */}
                      <NotificationBadge count={count} className="-right-2 -top-2" />
                    </span>
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
      <MobileCreateSheet
        isOpen={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        returnFocusRef={createTriggerRef}
        suggestedType={suggestedCreateType}
      />
    </>
  );
});

MobileBottomNav.displayName = 'MobileBottomNav';

export default MobileBottomNav;
