'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ChevronDown, Settings, LogOut, Handshake, BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth';
import { useDropdown } from '@/hooks/useDropdown';
import { toast } from 'sonner';
import DefaultAvatar from '@/components/ui/DefaultAvatar';
import { logger } from '@/utils/logger';
import { UserProfileDropdownPanel } from '@/components/ui/UserProfileDropdownPanel';
import type { MenuItem } from '@/components/ui/UserProfileDropdownPanel';
import { ROUTES } from '@/config/routes';

export interface UserProfileDropdownProps {
  variant?: 'simple' | 'advanced';
  showAvatar?: boolean;
  showDescriptions?: boolean;
  showUserInfo?: boolean;
  className?: string;
}

export default function UserProfileDropdown({
  variant = 'advanced',
  showAvatar = true,
  showDescriptions = true,
  showUserInfo = true,
  className = '',
}: UserProfileDropdownProps) {
  const router = useRouter();
  const { user, profile, session, signOut, isAuthenticated: _isAuthenticated } = useAuth();

  // ✅ FIXED: Call useAuthStore at component top level, not conditionally
  const { fetchProfile } = useAuthStore();

  // Menu items configuration
  const menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      icon: BarChart3,
      href: ROUTES.DASHBOARD.HOME,
      description: 'Overview and analytics',
    },
    {
      label: 'My Projects',
      icon: Handshake,
      href: ROUTES.DASHBOARD.PROJECTS,
      description: 'Manage your projects',
    },
    {
      label: 'Edit Profile',
      icon: Settings,
      href: ROUTES.DASHBOARD.INFO_EDIT,
      description: 'Update your information',
    },
  ];

  const {
    isOpen,
    focusedIndex,
    dropdownRef,
    buttonRef,
    itemRefs,
    toggle,
    close,
    setFocusedIndex,
    handleTriggerKeyDown,
  } = useDropdown({
    closeOnRouteChange: true,
    keyboardNavigation: variant === 'advanced',
    itemCount: menuItems.length,
  });

  const [avatarError, setAvatarError] = useState(false);

  // ✅ FIXED: Move useEffect before any conditional returns to follow Rules of Hooks
  useEffect(() => {
    if ((user || session) && !profile) {
      logger.debug(
        'User exists but no profile, fetching profile',
        { userId: user?.id || session?.user?.id },
        'UserProfileDropdown'
      );
      fetchProfile().catch(e => {
        logger.warn('Failed to fetch profile', e, 'UserProfileDropdown');
      });
    }
  }, [user, session, profile, fetchProfile]);

  const handleSignOut = async () => {
    close();

    if (variant === 'advanced') {
      // Advanced variant - show loading toast
      const loadingToast = toast.loading('Signing out...');

      const { error } = await signOut();

      if (error) {
        toast.dismiss(loadingToast);
        toast.error('Failed to sign out. Please try again.');
        logger.error(
          'UserProfileDropdown: Sign out error',
          { error: error.message },
          'UserProfileDropdown'
        );
      } else {
        toast.dismiss(loadingToast);
        toast.success('Signed out successfully!');
        router.push(ROUTES.HOME);
      }
    } else {
      // Simple variant - direct signout
      await signOut();
    }
  };

  const handleNavigation = (path: string) => {
    close();
    router.push(path);
  };

  const handlePublicProfileClick = () => {
    const username = profile?.username;
    if (username) {
      handleNavigation(ROUTES.PROFILE.SELF);
    } else {
      if (variant === 'advanced') {
        toast.error('Please set up your username first');
      }
      handleNavigation('/profile');
    }
  };

  // Guard clause - don't render if no user
  if (!user && !session) {
    return null;
  }

  // User display logic - always show something immediately, update when profile loads
  const avatarUrl = profile?.avatar_url;
  const email = user?.email || session?.user?.email || '';

  // Only show loading state when we have literally nothing to show
  const isProfileLoading = false; // Never block the UI — always render with best available data

  // PRIORITY: profile only. There is no second source.
  //
  // This chain used to continue: user_metadata.full_name → user_metadata.name →
  // the email local-part, TITLECASED. Each step is a better guess at the
  // person's legal name than the one before it, which is precisely backwards
  // for an account that chose a pseudonym. `firstname.lastname@…` came out of
  // that last branch as "Firstname Lastname" — the app reconstructing a real
  // name nobody typed, from an address the user never chose to display.
  //
  // user_metadata is whatever the OAuth provider handed over at signup and the
  // user cannot edit it; profiles is what they control. When the profile has
  // not loaded the honest answer is a placeholder, not a truer name.
  let displayName: string;
  if (profile?.name) {
    displayName = profile.name;
  } else if (profile?.username) {
    displayName = profile.username;
  } else {
    displayName = 'Me';
  }

  const username = profile?.username;

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    // REMOVED: logger.info statement for security
  }

  // Simple variant rendering
  if (variant === 'simple') {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          ref={buttonRef}
          onClick={toggle}
          disabled={false}
          className="flex items-center space-x-2 text-fg-primary focus:outline-none disabled:opacity-50"
        >
          <span className="text-sm font-medium">{displayName}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-md shadow-sm bg-surface-base ring-1 ring-black/5 dark:ring-border z-50">
            <div className="py-1" role="menu" aria-orientation="vertical">
              {menuItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => handleNavigation(item.href)}
                    className="flex items-center w-full px-4 py-2 text-sm text-fg-primary hover:bg-muted"
                    role="menuitem"
                  >
                    <Icon className="w-4 h-4 mr-3" />
                    {item.label}
                  </button>
                );
              })}
              <hr className="my-1 border-border-subtle" />
              <button
                onClick={handleSignOut}
                className="flex items-center w-full px-4 py-2 text-sm text-fg-primary hover:bg-muted"
                role="menuitem"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Advanced variant rendering
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={toggle}
        onKeyDown={handleTriggerKeyDown}
        disabled={isProfileLoading}
        className="flex h-11 items-center gap-1.5 rounded-md px-1.5 text-fg-secondary transition-colors hover:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50 sm:h-10 sm:gap-2 sm:px-2"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="User menu"
      >
        {showAvatar && (
          <span className="relative">
            {avatarUrl && !avatarError ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={32}
                height={32}
                className="rounded-full object-cover ring-2 ring-border-subtle hover:ring-border-strong transition-all duration-200 sm:w-9 sm:h-9 md:w-9 md:h-9"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <DefaultAvatar
                size={36}
                className="rounded-full ring-2 ring-border-subtle hover:ring-border-strong transition-all duration-200"
              />
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-status-positive border-2 border-card rounded-full shadow-sm"></div>
          </span>
        )}
        {/* Identity (name/@username/email) lives once in the dropdown panel —
            no name text in the trigger, to avoid the doubled "Mao / Mao" read. */}
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-300 ease-out ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <UserProfileDropdownPanel
          buttonRef={buttonRef}
          close={close}
          showUserInfo={showUserInfo}
          showDescriptions={showDescriptions}
          avatarUrl={avatarUrl}
          avatarError={avatarError}
          setAvatarError={setAvatarError}
          displayName={displayName}
          username={username}
          email={email}
          handlePublicProfileClick={handlePublicProfileClick}
          menuItems={menuItems}
          itemRefs={itemRefs}
          focusedIndex={focusedIndex}
          setFocusedIndex={setFocusedIndex}
          isOpen={isOpen}
          handleNavigation={handleNavigation}
          handleSignOut={handleSignOut}
        />
      )}
    </div>
  );
}
