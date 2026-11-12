'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  ShellPathnameContext,
  useRootShellPathname,
  useShellPathname,
} from '@/hooks/useShellPathname';
import { getRouteChrome, getRouteSurface } from '@/config/routes';
import GlobalCatLauncher from '@/components/ai-chat/GlobalCatLauncher';
import { STORAGE_KEYS } from '@/config/storage-keys';
import { Header } from './Header';
import { Sidebar } from '@/components/sidebar/Sidebar';
import Footer from './Footer';
import MobileBottomNav from './MobileBottomNav';
import { useNavigation } from '@/hooks/useNavigation';
import { sidebarSections, bottomNavItems } from '@/config/navigation';
import { MessageSyncManagerInitializer } from '@/components/MessageSyncManagerInitializer';
import { useUnreadMessagesSync } from '@/hooks/useUnreadMessagesSync';
import { ViewportHeightSync } from './ViewportHeightSync';

interface AppShellProps {
  children: ReactNode;
}

/**
 * AppShell Component
 *
 * Unified navigation shell that handles all layout logic:
 * - Header (always visible, context-aware)
 * - Sidebar (authenticated routes only)
 * - Main Content
 * - Footer (public routes only)
 * - MobileBottomNav (context-aware)
 *
 * Created: 2025-12-16
 * Last Modified: 2025-12-17
 * Last Modified Summary: Fixed hydration race condition - wait for auth hydration before rendering sidebar
 */
export function AppShell({ children }: AppShellProps) {
  // Read once, at the root layout, for every piece of chrome below: a 404's
  // chrome must be the same on the server and in the browser.
  const shellPathname = useRootShellPathname();
  return (
    <ShellPathnameContext.Provider value={shellPathname}>
      <AppShellChrome>{children}</AppShellChrome>
    </ShellPathnameContext.Provider>
  );
}

function AppShellChrome({ children }: AppShellProps) {
  const pathname = useShellPathname();
  // The address actually visited, for Cat's breadcrumb (set after load).
  const visitedPathname = usePathname();
  const { user, profile, hydrated, isLoading } = useAuth();
  // SSOT: every shell-related visibility decision derives from
  // getRouteSurface (src/config/routes.ts). Do not branch on pathname here.
  const surface = getRouteSurface(pathname ?? '/');
  const isAppSurface = surface === 'app';
  // Auth pages render their own minimal chrome — global header + nav +
  // search are noise on a sign-in screen and dilute the focus from the
  // form. Stripe/Linear/Notion all do this.
  const isAuthSurface = surface === 'auth';

  // Wait for auth hydration to prevent sidebar flash
  // During hydration, user is null even if authenticated - this prevents the sidebar from flickering
  const isAuthReady = hydrated && !isLoading;
  const shouldShowSidebar = isAppSurface && isAuthReady && user;

  // Get navigation state and functions
  const {
    navigationState,
    toggleSidebar,
    toggleSidebarCollapse,
    toggleSection,
    setSidebarCollapsed,
    isItemActive,
    getFilteredSections,
  } = useNavigation(sidebarSections);

  // One fetch for every Messages badge (header, sidebar, phone tab bar).
  useUnreadMessagesSync();

  const routeChrome = getRouteChrome(pathname ?? '/');
  // Mirrors MobileBottomNav visibility — when the bottom nav renders, reserve
  // space below the main scroll area so its content isn't covered.
  const showsMobileBottomNav = isAppSurface && !routeChrome.hideMobileBottomNav;

  useEffect(() => {
    if (routeChrome.preferCollapsedSidebar) {
      setSidebarCollapsed(true);
    }
  }, [pathname, routeChrome.preferCollapsedSidebar, setSidebarCollapsed]);

  // Track the user's previous in-app path so Cat can reference "the page you
  // just came from" — document.referrer is stale across Next.js client-side
  // navigations, so we maintain a session breadcrumb ourselves.
  const previousPathnameRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || !visitedPathname) {
      return;
    }
    const prev = previousPathnameRef.current;
    if (prev && prev !== visitedPathname) {
      try {
        window.sessionStorage.setItem(STORAGE_KEYS.LAST_VISITED_PATH, prev);
      } catch {
        /* sessionStorage unavailable; Cat falls back to document.referrer */
      }
    }
    previousPathnameRef.current = visitedPathname;
  }, [visitedPathname]);

  // Sidebar margin-left animates from 0 → 16rem/64rem when auth hydrates,
  // which produces a 300ms content slide on every page load — the
  // "page is dancing" feeling. Suppress the transition until after the
  // initial render so the sidebar appears in its final position
  // instantly. User-initiated sidebar toggles (after this delay)
  // still animate normally.
  const [allowMarginTransition, setAllowMarginTransition] = useState(false);
  useEffect(() => {
    if (!isAuthReady) {
      return;
    }
    const frame = requestAnimationFrame(() => setAllowMarginTransition(true));
    return () => cancelAnimationFrame(frame);
  }, [isAuthReady]);

  // Get filtered sections based on auth state
  const filteredSections = getFilteredSections();

  // Auth surface: no global chrome at all. The /auth page is its own
  // self-contained universe with its own minimal back-link.
  if (isAuthSurface) {
    // No header or tab bar here to clear the status bar and home indicator,
    // so the screen does (globals.css, "Safe areas").
    return (
      <div className="min-h-screen bg-surface-page safe-area-padding-top app-page-foot">
        <MessageSyncManagerInitializer />
        {/* The feedback launcher is the edge tab here too: the round button
            sat on the "Sign in" button at 390px (seen live 2026-11-12). */}
        <main id="main-content" data-fc-place="tab" className="min-h-screen">
          {children}
        </main>
      </div>
    );
  }

  // The home-indicator inset at the foot of the page, applied once: where the
  // tab bar shows, main's clearance below already carries it; elsewhere the
  // shell's last edge does (globals.css, .app-page-foot).
  return (
    <div
      className={`min-h-screen flex flex-col bg-surface-page ${
        showsMobileBottomNav ? '' : 'app-page-foot'
      }`}
    >
      {/* Initialize message sync manager */}
      <MessageSyncManagerInitializer />

      {/* Publishes --app-viewport-height so full-height surfaces (chat) track
          the visible viewport when the soft keyboard opens. */}
      <ViewportHeightSync />

      {/* Header - Always visible on non-auth surfaces */}
      {/* Where the chat is the whole phone screen (routeChrome.immersiveChat)
          the header steps aside below md; the page's own floating toolbar
          carries the way home. */}
      <Header
        showSidebarToggle={!!shouldShowSidebar}
        onToggleSidebar={toggleSidebar}
        showSearch={true}
        variant="default"
        className={routeChrome.immersiveChat ? 'max-md:hidden' : undefined}
      />

      {/* Main Layout Container — clears the fixed header (56px / 64px) plus
          the email banner inside it, when shown (globals.css). */}
      <div
        className={`flex flex-1 app-header-offset ${
          routeChrome.immersiveChat ? 'app-immersive-chat' : ''
        }`}
      >
        {/* Sidebar - Only for authenticated routes when auth is ready */}
        {shouldShowSidebar && (
          <Sidebar
            user={user}
            profile={profile}
            sections={filteredSections}
            bottomItems={bottomNavItems}
            navigationState={navigationState}
            isItemActive={isItemActive}
            toggleSidebar={toggleSidebar}
            toggleSidebarCollapse={toggleSidebarCollapse}
            toggleSection={toggleSection}
            aboveMobileNav={showsMobileBottomNav}
          />
        )}

        {/* Main Content Area
            min-w-0 lets the flex item shrink below its content's intrinsic
            width (default `min-width: auto` would expand to match a child's
            min-content, e.g. an overflow-x-auto rail using `min-w-max`,
            blowing layout out wider than the viewport on mobile). */}
        <main
          id="main-content"
          data-fc-place={routeChrome.feedbackTab ? 'tab' : undefined}
          className={`flex-1 min-w-0 ${
            allowMarginTransition ? 'transition-[margin-left] duration-300 ease-in-out' : ''
          } ${
            shouldShowSidebar
              ? navigationState.isSidebarCollapsed
                ? 'lg:ml-16'
                : 'lg:ml-64'
              : 'ml-0'
          } ${showsMobileBottomNav && !routeChrome.ownsMobileNavClearance ? 'app-bottom-nav-clearance' : ''}`}
        >
          {children}
        </main>
      </div>

      {/* Footer - Only for public routes (handled internally by Footer component) */}
      <Footer />

      {/* Mobile Bottom Navigation - Context-aware (handles its own visibility) */}
      <MobileBottomNav />

      {/* Global Cat — reachable from any authenticated app page, page-context-aware.
          Hidden where a conversation IS the page (the Cat hub, a companion's room). */}
      {isAppSurface && isAuthReady && user && !routeChrome.hideGlobalCat && <GlobalCatLauncher />}
    </div>
  );
}
