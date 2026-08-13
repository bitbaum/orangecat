import Image from 'next/image';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { UserPlus, UserMinus, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GRADIENTS } from '@/config/gradients';
import type { Profile } from '@/types/profile';
import { ROUTES } from '@/config/routes';

interface PersonCardProps {
  profile: Profile;
  activeTab: 'following' | 'followers' | 'all';
  isFollowing: boolean;
  isActionLoading: boolean;
  onFollow: (profileId: string) => void;
  onUnfollow: (profileId: string) => void;
}

export default function PersonCard({
  profile,
  activeTab,
  isFollowing: isUserFollowing,
  isActionLoading,
  onFollow,
  onUnfollow,
}: PersonCardProps) {
  const displayName = profile.name || profile.username || 'Anonymous';
  const profileHref = profile.username
    ? ROUTES.PROFILES.VIEW(profile.username)
    : null;
  const avatar = (
    <div
      className={cn(
        GRADIENTS.brandOrangeLightBr,
        'relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0'
      )}
    >
      {profile.avatar_url ? (
        <Image src={profile.avatar_url} alt={displayName} fill className="object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-fg-primary font-semibold text-xl">
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );

  return (
    <Card className="oc-card-link">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          {profileHref ? <Link href={profileHref}>{avatar}</Link> : avatar}

          {/* Info */}
          <div className="flex-1 min-w-0">
            {profileHref ? (
              <Link href={profileHref}>
                <h3 className="font-semibold text-fg-primary hover:underline underline-offset-4 truncate">
                  {displayName}
                </h3>
              </Link>
            ) : (
              <h3 className="font-semibold text-fg-primary truncate">{displayName}</h3>
            )}
            {profile.username && (
              <p className="text-sm text-fg-secondary truncate">@{profile.username}</p>
            )}
            {profile.bio && (
              <p className="text-sm text-fg-secondary mt-1 line-clamp-2">{profile.bio}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-3 items-center">
              {activeTab === 'followers' && !isUserFollowing && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-surface-raised text-fg-primary border border-subtle">
                  Follow back
                </span>
              )}
              {activeTab !== 'following' && !isUserFollowing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onFollow(profile.id)}
                  disabled={isActionLoading}
                >
                  <UserPlus className="w-3 h-3 mr-1" />
                  Follow
                </Button>
              )}
              {isUserFollowing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUnfollow(profile.id)}
                  disabled={isActionLoading}
                >
                  <UserMinus className="w-3 h-3 mr-1" />
                  Unfollow
                </Button>
              )}
              {(profile.bitcoin_address || profile.lightning_address) && profileHref && (
                <Link href={profileHref}>
                  <Button size="sm" variant="outline">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Send BTC
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
