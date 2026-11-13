'use client';

import { ROUTES } from '@/config/routes';
import ShareContent from './ShareContent';
import { APP_NAME, APP_TAGLINE, SITE_URL } from '@/config/brand';

interface ProfileShareProps {
  username: string;
  profileName: string;
  profileBio?: string;
  currentUrl?: string;
  onClose?: () => void;
  variant?: 'dropdown' | 'modal';
  className?: string;
}

/**
 * ProfileShare Component
 *
 * Wrapper around ShareContent for profile-specific sharing.
 * DRY: Uses reusable ShareContent component.
 */
export default function ProfileShare({
  username,
  profileName,
  profileBio = '',
  currentUrl,
  onClose,
  variant: _variant = 'dropdown',
  className = '',
}: ProfileShareProps) {
  // Construct the profile URL
  const profileUrl =
    currentUrl ||
    `${typeof window !== 'undefined' ? window.location.origin : SITE_URL}${ROUTES.PROFILES.VIEW(username)}`;

  // Create optimized share text
  const shareTitle = `${profileName} on ${APP_NAME}`;
  const shareDescription =
    profileBio ||
    `Check out ${profileName}'s profile on ${APP_NAME} — ${APP_TAGLINE.toLowerCase()}`;

  return (
    <ShareContent
      title={shareTitle}
      description={shareDescription}
      url={profileUrl}
      onClose={onClose}
      className={className}
      titleText="Share profile"
    />
  );
}
