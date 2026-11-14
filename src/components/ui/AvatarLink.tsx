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
import { User } from 'lucide-react';
import { CatAvatar } from '@/components/cat/CatAvatar';
import { isCatUsername } from '@/config/cat-identity';
import { getInitial } from '@/utils/string';
import { bylineName, needsBylineName } from '@/utils/byline';

interface AvatarLinkProps {
  /**
   * Username or user ID for the profile link
   * If username is provided, uses /profiles/{username}
   * Otherwise falls back to /profiles/{userId} or /profiles/me for current user
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
  userId,
  avatarUrl,
  name,
  size = 48,
  className = '',
  showOnlineStatus = false,
  isCurrentUser = false,
}: AvatarLinkProps) {
  // Determine profile URL - prefer username, fallback to userId or /profiles/me
  // Ensure username is a valid non-empty string before using it in URL
  const validUsername = username && typeof username === 'string' && username.trim().length > 0;
  const validUserId = userId && typeof userId === 'string' && userId.trim().length > 0;

  const profileUrl = validUsername
    ? `/profiles/${encodeURIComponent(username.trim())}`
    : validUserId
      ? `/profiles/${encodeURIComponent(userId.trim())}`
      : isCurrentUser
        ? '/profiles/me'
        : '#';

  // Signed like every byline: a minted `user_<hex>` handle is neither the
  // label nor the letter. With no name worth a letter, the plate holds a
  // person glyph instead of the "A" of the neutral phrase.
  const displayName = bylineName(name, username);
  const anonymous = needsBylineName(name, username);
  const initial = getInitial(displayName);

  // Ensure href is always a valid string
  const safeHref = typeof profileUrl === 'string' ? profileUrl : '#';

  return (
    <Link
      href={safeHref}
      className={cn(
        'relative flex-shrink-0 inline-block transition-all duration-200',
        'hover:ring-2 hover:ring-border-strong rounded-full',
        className
      )}
      title={`View ${displayName}'s profile`}
    >
      {isCatUsername(username) ? (
        <CatAvatar size={size} />
      ) : avatarUrl ? (
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
          {anonymous ? (
            <User aria-hidden="true" style={{ width: size * 0.5, height: size * 0.5 }} />
          ) : (
            initial
          )}
        </div>
      )}
      {showOnlineStatus && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-status-positive border-2 border-card rounded-full" />
      )}
    </Link>
  );
}
