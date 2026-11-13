'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import ProfileShare from '@/components/sharing/ProfileShare';
import { Share2 } from 'lucide-react';
import { isPlaceholderName } from './DashboardHeader';

interface DashboardInviteCTAProps {
  profile: {
    username?: string | null;
    name?: string | null;
    bio?: string | null;
  } | null;
  userId: string;
}

/**
 * DashboardInviteCTA - Invite friends and share profile section
 */
export function DashboardInviteCTA({ profile, userId }: DashboardInviteCTAProps) {
  const [showShare, setShowShare] = useState(false);

  // A profile with no name yet shares as "User" behind a generated handle:
  // nothing to invite anyone to. The ask comes back once there is a name.
  if (!profile || isPlaceholderName(profile.name, profile.username)) {
    return null;
  }

  // Single CTA per card: Share. Copy-link lives inside ProfileShare;
  // Discover lives in the main nav. Three competing buttons were dilution.
  return (
    <div className="relative rounded-md border border-subtle bg-surface-raised/30 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-semibold text-fg-primary">
            Invite friends to OrangeCat
          </h3>
          <p className="mb-0 text-xs sm:text-sm text-fg-secondary mt-1">
            Share your profile and start building your network
          </p>
        </div>
        <Button
          onClick={() => setShowShare(!showShare)}
          size="sm"
          variant="outline"
          // An invitation is a suggestion, not the page's action: outline,
          // not the filled ink it used to wear.
          className="min-h-11 shrink-0"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </div>
      {showShare && (
        <div className="absolute right-4 top-full mt-2 z-50">
          <ProfileShare
            username={profile.username || userId}
            profileName={profile.name || profile.username || 'My Profile'}
            profileBio={profile.bio || undefined}
            onClose={() => setShowShare(false)}
          />
        </div>
      )}
    </div>
  );
}

export default DashboardInviteCTA;
