'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { useMobileMenu } from '@/hooks/useMobileMenu';
import { useIsAuthRoute } from '@/hooks/useRouteContext';
import { useMobileMenuAnimation } from '@/hooks/useMobileMenuAnimation';
import { getHeaderNavigationItems, footerNavigation } from '@/config/navigation';
import { getAuthStatus } from '@/lib/auth/utils';
import { getHeaderClasses } from '@/lib/ui/header-utils';
import { HEADER_DIMENSIONS, HEADER_SPACING } from '@/constants/header';
import Logo from './Logo';
import AuthButtons from './AuthButtons';
import { HeaderCreateButton } from '@/components/dashboard/HeaderCreateButton';
import { SearchTrigger } from '@/components/search/SearchTrigger';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import { EmailConfirmationBanner } from './EmailConfirmationBanner';
import { MessagesButton, NotificationsButton } from './HeaderActions';
import { MenuToggleButton } from './MenuToggleButton';
import { DesktopNavigation } from './DesktopNavigation';
import { MobileMenu } from './MobileMenu';
import UserProfileDropdown from '@/components/ui/UserProfileDropdown';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface HeaderProps {
  /** Whether to show the sidebar toggle button (authenticated routes) */
  showSidebarToggle?: boolean;
  /** Callback to toggle sidebar */
  onToggleSidebar?: () => void;
  /** Whether to show search functionality */
  showSearch?: boolean;
  /** Header variant */
  variant?: 'default' | 'minimal';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Unified Header Component
 *
 * Single header component that adapts to both public and authenticated contexts.
 * Handles all navigation, search, notifications, and user interactions.
 */
export function Header({
  showSidebarToggle = false,
  onToggleSidebar,
  showSearch = true,
  variant: _variant = 'default',
  className = '',
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  const authState = useAuth();
  const authStatus = getAuthStatus(authState);
  const { isScrolled, isHidden } = useHeaderScroll();

  // Announce the header's visibility on <html> so anything pinned below it
  // (`.sticky-below-header` in globals.css) can move up when it hides —
  // otherwise it leaves an empty band where the header was.
  useEffect(() => {
    document.documentElement.dataset.headerHidden = isHidden ? 'true' : 'false';
  }, [isHidden]);
  const mobileMenu = useMobileMenu();
  const isAuthRoute = useIsAuthRoute();
  const navigation = getHeaderNavigationItems();

  // Marketing nav (top links + hamburger menu) is for anonymous visitors
  // only. Signed-in users get ONE navigation system — the app sidebar +
  // header actions — everywhere, including public pages and 404/error
  // pages, instead of a second competing marketing nav.
  const showMarketingNav = !isAuthRoute && !authStatus.authenticated;

  // Mobile menu animation state
  const { menuRef, buttonRef, isClosing, handleClose } = useMobileMenuAnimation({
    isOpen: mobileMenu.isOpen,
    onClose: mobileMenu.close,
  });

  // Header classes with scroll behavior
  const headerClasses = getHeaderClasses(isScrolled, isHidden, className);

  return (
    <>
      <header
        className={headerClasses}
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        {/* Mobile-First Header: Optimized for small screens */}
        <div
          className={`mx-auto ${HEADER_SPACING.MAX_WIDTH} ${HEADER_DIMENSIONS.HEIGHT_MOBILE} ${HEADER_DIMENSIONS.HEIGHT_DESKTOP} ${HEADER_SPACING.CONTAINER_PADDING} flex items-center justify-between w-full ${HEADER_SPACING.ITEM_GAP}`}
        >
          {/* Left Section: Menu + Logo (Mobile-First) */}
          <div className={`flex items-center ${HEADER_SPACING.ITEM_GAP} shrink-0`}>
            {/* Sidebar/Menu Toggle - Always first, proper touch target */}
            {showSidebarToggle && onToggleSidebar ? (
              <MenuToggleButton onClick={onToggleSidebar} ariaLabel="Toggle sidebar" />
            ) : showMarketingNav ? (
              <MenuToggleButton
                ref={buttonRef}
                onClick={() => mobileMenu.open()}
                ariaLabel="Open navigation menu"
              />
            ) : null}

            {/* Logo - Icon only on mobile, text on larger screens */}
            <div className="flex-shrink-0 min-w-0">
              <Logo showText={false} size="sm" className="sm:hidden" />
              <Logo showText={true} size="md" className="hidden sm:flex" />
            </div>

            {/* Desktop Navigation Links — anonymous marketing surfaces only.
                Signed-in users navigate via the sidebar; rendering these for
                them (e.g. on 404/error or public pages) was a second,
                redundant nav system. */}
            {showMarketingNav && <DesktopNavigation items={navigation} />}
          </div>

          {/* Center Section: Search trigger (Desktop only). Opens the
              CommandPalette — see src/components/search/CommandPalette.tsx. */}
          {showSearch && (
            <div className="hidden md:flex flex-1 min-w-0 max-w-sm lg:max-w-md mx-4 lg:mx-8">
              <SearchTrigger />
            </div>
          )}

          {/* Right Section: Actions (Mobile-Optimized) */}
          <div className={`flex items-center ${HEADER_SPACING.ACTION_GAP} flex-shrink-0`}>
            {/* Mobile search — icon-only trigger that opens the same palette. */}
            {showSearch && (
              <div className="md:hidden">
                <SearchTrigger compact />
              </div>
            )}

            {/* Create Button (authenticated only) - Icon only on mobile */}
            {isAuthRoute && (
              <div className="hidden sm:block">
                <HeaderCreateButton />
              </div>
            )}

            {/* Messages Button - Always visible for authenticated users regardless of route */}
            {authStatus.authenticated && <MessagesButton />}

            {/* Notifications - Always visible for authenticated users regardless of route */}
            {authStatus.authenticated && (
              <NotificationsButton
                onClick={() => setShowNotifications(!showNotifications)}
                isOpen={showNotifications}
              />
            )}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu or Auth Buttons */}
            <div className="flex-shrink-0">
              {authStatus.authenticated ? <UserProfileDropdown /> : <AuthButtons />}
            </div>
          </div>
        </div>
      </header>

      {/* Email Confirmation Banner — only on in-app surfaces. Hiding it on
          marketing/auth pages avoids pushing the sign-in form down. Also
          hide for anonymous users (signInAnonymously) — they have no email
          to confirm, so the banner is nonsensical and just adds noise to
          the "Try it anonymously" upgrade-anytime flow. */}
      {isAuthRoute &&
        authStatus.authenticated &&
        authState.user &&
        !authState.user.is_anonymous && (
          <EmailConfirmationBanner
            emailConfirmedAt={authState.user.email_confirmed_at}
            userId={authState.user.id}
            className={`fixed ${HEADER_DIMENSIONS.TOP_OFFSET_MOBILE} ${HEADER_DIMENSIONS.TOP_OFFSET_DESKTOP} left-0 right-0 z-40`}
          />
        )}

      {/* Mobile search now uses the CommandPalette — no separate modal. */}

      {/* Notification Center */}
      {showNotifications && (
        <NotificationCenter
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {/* Mobile Menu (anonymous marketing surfaces only) */}
      {showMarketingNav && (
        <MobileMenu
          isOpen={mobileMenu.isOpen}
          isClosing={isClosing}
          menuRef={menuRef}
          navigation={navigation}
          footer={footerNavigation}
          onClose={handleClose}
        />
      )}
    </>
  );
}
