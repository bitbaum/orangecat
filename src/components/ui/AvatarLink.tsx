/**
 * AvatarLink Component
 *
 * Reusable avatar component that always links to a user's public profile (overview tab).
 * Ensures DRY code and consistent behavior across the application.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Created reusable avatar link component
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getInitial } from '@/utils/string';
import { ROUTES } from '@/config/routes';

interface AvatarLinkProps {
  /**
   * Canonical username for the profile link. `userId` remains accepted for
   * call-site compatibility but is never emitted as a public profile path.
   */
  username?: string | null;
  userId?: string | null;

  /**
   * Avatar image URL
   */
  avatarUrl?: string | null;

  /**
   * Display name for alt text and fallback initial
   */
  name?: string | null;

  /**
   * Size of the avatar (default: 48)
   */
  size?: number;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Show online status indicator (green dot)
   */
  showOnlineStatus?: boolean;

  /**
   * Whether this is the current user's avatar
   */
  isCurrentUser?: boolean;
}

/**
 * AvatarLink - Reusable avatar component that links to profile
 *
 * Always navigates to /profiles/{username} (overview tab) when clicked.
 * Handles both image avatars and fallback initials.
 */
export default function AvatarLink({
  username,
  userId: _userId,
  avatarUrl,
  name,
  size = 48,
  className = '',
  showOnlineStatus = false,
  isCurrentUser = false,
}: AvatarLinkProps) {
  // Public profiles resolve by username only. An actor/user ID in this URL
  // looks valid but always lands on not-found.
  const validUsername = username && typeof username === 'string' && username.trim().length > 0;
  const profileUrl = validUsername
    ? ROUTES.PROFILES.VIEW(username.trim())
    : isCurrentUser
      ? ROUTES.PROFILES.ME
      : null;

  const displayName = name || username || 'User';
  const initial = getInitial(displayName);

  const avatar = (
    <>
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={`${displayName}'s avatar`}
          width={size}
          height={size}
          className={cn(
            'rounded-full object-cover border-2 border-card shadow-sm',
            'transition-all duration-200'
          )}
        />
      ) : (
        <div
          className={cn(
            'rounded-full flex items-center justify-center border-2 border-card shadow-sm',
            'bg-muted text-fg-secondary font-semibold transition-all duration-200'
          )}
          style={{ width: size, height: size, fontSize: `${size * 0.4}px` }}
        >
          {initial}
        </div>
      )}
      {showOnlineStatus && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-status-positive border-2 border-card rounded-full" />
      )}
    </>
  );

  const baseClassName = cn(
    'relative flex-shrink-0 inline-block rounded-full transition-all duration-200',
    className
  );

  return profileUrl ? (
    <Link
      href={profileUrl}
      className={cn(baseClassName, 'hover:ring-2 hover:ring-border-strong')}
      title={`View ${displayName}'s profile`}
    >
      {avatar}
    </Link>
  ) : (
    <span className={baseClassName} title={displayName}>
      {avatar}
    </span>
  );
}
