'use client';

import Button from '@/components/ui/Button';
import UserProfileDropdown from '@/components/ui/UserProfileDropdown';
import { useAuth } from '@/hooks/useAuth';
import { useIsAuthRoute } from '@/hooks/useRouteContext';
import { authNavigationItems } from '@/config/navigation';
import { getAuthStatus } from '@/lib/auth/utils';
import { Loader2 } from 'lucide-react';

interface AuthButtonsProps {
  className?: string;
}

export default function AuthButtons({ className = '' }: AuthButtonsProps) {
  const authState = useAuth();
  const authStatus = getAuthStatus(authState);
  const isAuthRoute = useIsAuthRoute();
  const isMobileNav = className.includes('flex-col');
  const [signIn, getStarted] = authNavigationItems;

  // During auth hydration: on a public surface keep Sign In / Get Started
  // actionable; on an authed surface render a neutral avatar skeleton so a
  // signed-in user landing on /settings/notifications etc. doesn't flash
  // 'Sign In / Get Started' for a frame before their user menu appears.
  if (!authState.hydrated) {
    if (isAuthRoute) {
      return <div className="h-9 w-9 rounded-full bg-surface-raised animate-pulse" aria-hidden />;
    }
    return (
      <UnauthenticatedButtons
        signIn={signIn}
        getStarted={getStarted}
        isMobileNav={isMobileNav}
        className={className}
      />
    );
  }

  // Show spinner while loading
  if (authStatus.showLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-fg-primary" />
      </div>
    );
  }

  // If authenticated, show user profile dropdown
  if (authStatus.authenticated) {
    return <UserProfileDropdown variant="advanced" />;
  }

  // Show auth buttons for unauthenticated users
  return (
    <UnauthenticatedButtons
      signIn={signIn}
      getStarted={getStarted}
      isMobileNav={isMobileNav}
      className={className}
    />
  );
}

interface UnauthenticatedButtonsProps {
  signIn: (typeof authNavigationItems)[number];
  getStarted: (typeof authNavigationItems)[number];
  isMobileNav: boolean;
  className: string;
}

function UnauthenticatedButtons({
  signIn,
  getStarted,
  isMobileNav,
  className,
}: UnauthenticatedButtonsProps) {
  return (
    <div
      className={`flex items-center ${isMobileNav ? 'flex-col space-y-2 w-full' : 'space-x-2'} ${className}`}
    >
      {/* Mobile: Single prominent login button — warm accent (top-of-funnel) */}
      <Button
        href={getStarted.href}
        variant="accent"
        size="sm"
        className="min-h-9 min-w-18 text-sm font-medium sm:hidden"
      >
        Login
      </Button>
      {/* Desktop: Both sign in and get started buttons */}
      <Button
        href={signIn.href}
        variant="ghost"
        size="sm"
        className={`hidden sm:inline-flex min-h-9 text-sm ${isMobileNav ? 'w-full justify-center' : ''}`}
      >
        {signIn.name}
      </Button>
      <Button
        href={getStarted.href}
        variant="accent"
        size="sm"
        className={`hidden sm:inline-flex min-h-9 text-sm ${isMobileNav ? 'w-full justify-center' : ''}`}
      >
        {getStarted.name}
      </Button>
    </div>
  );
}
