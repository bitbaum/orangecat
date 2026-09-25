'use client';

import { Share2, UserPlus, UserCheck, Pencil, Bitcoin, MessageSquare } from 'lucide-react';
import Button from '@/components/ui/Button';
import ProfileShare from '@/components/sharing/ProfileShare';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { useCanReceive } from './useCanReceive';
import type { ScalableProfile } from '@/services/profile/types';

interface ProfileActionsProps {
  profile: ScalableProfile;
  isOwnProfile: boolean;
  isFollowing: boolean;
  isFollowLoading: boolean;
  showShare: boolean;
  shareButtonRef: React.RefObject<HTMLDivElement | null>;
  shareDropdownRef: React.RefObject<HTMLDivElement | null>;
  onShareToggle: () => void;
  onFollowToggle: () => void;
  className?: string;
}

// On a phone the row is full width and every button but Share takes an equal
// share of it, and Message/Follow drop their icons there, so the labels fit
// instead of collapsing to icons (Follow used to read as a bare "+").
const ACTION = 'min-h-11 flex-1 sm:flex-none';

/** Pay · Message · Follow (or Edit profile for the owner) · Share. */
export function ProfileActions({
  profile,
  isOwnProfile,
  isFollowing,
  isFollowLoading,
  showShare,
  shareButtonRef,
  shareDropdownRef,
  onShareToggle,
  onFollowToggle,
  className,
}: ProfileActionsProps) {
  const displayName = profile.name || profile.username || 'User';
  // Pay only when a payment would land — the same check the pay flow runs.
  const canReceive = useCanReceive(profile.username);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {profile.username && canReceive && (
        <Button href={ROUTES.PAY(profile.username)} variant="accent" size="sm" className={ACTION}>
          <Bitcoin className="mr-1.5 h-4 w-4" aria-hidden />
          Pay
        </Button>
      )}

      {isOwnProfile ? (
        <Button href={ROUTES.DASHBOARD.INFO_EDIT} variant="outline" size="sm" className={ACTION}>
          <Pencil className="mr-1.5 h-4 w-4" aria-hidden />
          Edit profile
        </Button>
      ) : (
        <>
          {profile.id && (
            <Button
              href={`${ROUTES.MESSAGES}?to=${encodeURIComponent(profile.id)}`}
              variant="outline"
              size="sm"
              className={ACTION}
            >
              <MessageSquare className="mr-1.5 hidden h-4 w-4 sm:block" aria-hidden />
              Message
            </Button>
          )}
          <Button
            onClick={onFollowToggle}
            disabled={isFollowLoading}
            variant={isFollowing ? 'secondary' : 'outline'}
            size="sm"
            className={ACTION}
            aria-pressed={isFollowing}
          >
            {isFollowing ? (
              <UserCheck className="mr-1.5 hidden h-4 w-4 sm:block" aria-hidden />
            ) : (
              <UserPlus className="mr-1.5 hidden h-4 w-4 sm:block" aria-hidden />
            )}
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
        </>
      )}

      <div className="relative" ref={shareButtonRef}>
        <Button
          onClick={onShareToggle}
          variant="outline"
          size="sm"
          className="min-h-11 min-w-11"
          aria-label={`Share ${displayName}'s profile`}
          aria-expanded={showShare}
        >
          <Share2 className="h-4 w-4" aria-hidden />
        </Button>
        {showShare && (
          // A sheet pinned to the bottom on a phone, a dropdown under the
          // button from sm up. This used to be decided by reading
          // window.innerWidth during render, which differs between server and
          // client — responsive classes say the same thing without a mismatch.
          <div
            ref={shareDropdownRef}
            className="fixed bottom-5 left-1/2 z-modal -translate-x-1/2 sm:absolute sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:translate-x-0"
          >
            <ProfileShare
              username={profile.username || ''}
              profileName={displayName}
              profileBio={profile.bio ?? undefined}
              onClose={onShareToggle}
            />
          </div>
        )}
      </div>
    </div>
  );
}
