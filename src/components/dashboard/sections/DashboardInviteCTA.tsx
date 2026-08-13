'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import ProfileShare from '@/components/sharing/ProfileShare';
import { Share2 } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { optionalPublicProfilePath } from '@/config/public-profile-path';

interface DashboardInviteCTAProps {
  profile: {
    username?: string | null;
    name?: string | null;
    bio?: string | null;
  } | null;
}

/**
 * DashboardInviteCTA - Invite friends and share profile section
 */
export function DashboardInviteCTA({ profile }: DashboardInviteCTAProps) {
  const [showShare, setShowShare] = useState(false);
  const username = profile?.username?.trim() || null;
  const hasPublicProfile = optionalPublicProfilePath(username) !== null;

  // Single CTA per card: Share. Copy-link lives inside ProfileShare;
  // Discover lives in the main nav. Three competing buttons were dilution.
  return (
    <div className="relative rounded-md border border-subtle bg-surface-raised/30 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-semibold text-fg-primary">
            Invite friends to OrangeCat
          </h3>
          <p className="text-xs sm:text-sm text-fg-secondary mt-1">
            Share your profile and start building your network
          </p>
        </div>
        {hasPublicProfile ? (
          <Button
            onClick={() => setShowShare(!showShare)}
            size="sm"
            className="min-h-11 bg-fg-primary text-fg-inverted hover:bg-fg-primary/90 shrink-0"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        ) : (
          <Button
            href={ROUTES.DASHBOARD.INFO_EDIT}
            size="sm"
            className="min-h-11 shrink-0"
          >
            Choose username
          </Button>
        )}
      </div>
      {showShare && hasPublicProfile && username && (
        <div className="absolute right-4 top-full z-50 mt-2 max-w-[calc(100vw-2rem)]">
          <ProfileShare
            username={username}
            profileName={profile?.name || username}
            profileBio={profile?.bio || undefined}
            onClose={() => setShowShare(false)}
          />
        </div>
      )}
    </div>
  );
}

export default DashboardInviteCTA;
