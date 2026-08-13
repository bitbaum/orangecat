'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink, Users } from 'lucide-react';
import { getInitial } from '@/utils/string';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DefaultAvatar from '@/components/ui/DefaultAvatar';
import { SearchProfile } from '@/services/search';
import { ROUTES } from '@/config/routes';
import { MAKER_STATUS_METADATA, isMakerStatus } from '@/config/maker-status';

interface ProfileCardProps {
  profile: SearchProfile;
  viewMode?: 'grid' | 'list';
}

export default function ProfileCard({ profile, viewMode = 'grid' }: ProfileCardProps) {
  const displayName = profile.name || profile.username || 'Anonymous';
  const profileHref = profile.username
    ? ROUTES.PROFILES.VIEW(profile.username)
    : null;

  const TypeBadge = () => (
    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-surface-raised text-fg-secondary border border-border-subtle">
      <Users className="w-3 h-3 mr-1" />
      Person
    </div>
  );

  const StatusBadge = () =>
    isMakerStatus(profile.current_status) ? (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-surface-raised text-fg-primary border border-default">
        {MAKER_STATUS_METADATA[profile.current_status].label}
      </span>
    ) : null;

  if (viewMode === 'list') {
    const avatar = <ProfileAvatar profile={profile} displayName={displayName} size={48} />;
    return (
      <Card className="p-4 oc-card-link">
        <div className="flex items-center gap-4">
          {profileHref ? <Link href={profileHref}>{avatar}</Link> : avatar}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {profileHref ? (
                <Link href={profileHref}>
                  <h3 className="font-semibold text-fg-primary hover:underline underline-offset-4 truncate">
                    {displayName}
                  </h3>
                </Link>
              ) : (
                <h3 className="font-semibold text-fg-primary truncate">{displayName}</h3>
              )}
              <TypeBadge />
            </div>
            {profile.username && (
              <p className="text-sm text-fg-secondary truncate">@{profile.username}</p>
            )}
            {isMakerStatus(profile.current_status) && (
              <div className="mt-1">
                <StatusBadge />
              </div>
            )}
            {profile.bio && (
              <p className="text-sm text-fg-secondary mt-1 line-clamp-2">{profile.bio}</p>
            )}
          </div>

          {profileHref && (
            <div className="flex-shrink-0">
              <Link href={profileHref}>
                <Button size="sm" variant="outline">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View Profile
                </Button>
              </Link>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Grid view
  const avatar = <ProfileAvatar profile={profile} displayName={displayName} size={80} />;
  return (
    <Card className="h-full p-6 oc-card-link">
      <div className="text-center">
        {profileHref ? <Link href={profileHref}>{avatar}</Link> : avatar}

        <div className="flex items-center justify-center gap-2 mb-2">
          {profileHref ? (
            <Link href={profileHref}>
              <h3 className="font-semibold text-fg-primary hover:underline underline-offset-4">
                {displayName}
              </h3>
            </Link>
          ) : (
            <h3 className="font-semibold text-fg-primary">{displayName}</h3>
          )}
          <TypeBadge />
        </div>

        {profile.username && <p className="text-sm text-fg-secondary mb-3">@{profile.username}</p>}

        {isMakerStatus(profile.current_status) && (
          <div className="-mt-2 mb-3">
            <StatusBadge />
          </div>
        )}

        {profile.bio && (
          <p className="text-sm text-fg-secondary mb-4 line-clamp-3">{profile.bio}</p>
        )}

        {profileHref && (
          <Link href={profileHref}>
            <Button size="sm" variant="outline" className="w-full">
              <ExternalLink className="w-3 h-3 mr-1" />
              View Profile
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}

function ProfileAvatar({
  profile,
  displayName,
  size,
}: {
  profile: SearchProfile;
  displayName: string;
  size: 48 | 80;
}) {
  const dimensionClass = size === 48 ? 'h-12 w-12' : 'h-20 w-20';
  return (
    <div
      className={`relative ${dimensionClass} flex-shrink-0 overflow-hidden rounded-full bg-surface-raised ${
        size === 80 ? 'mx-auto mb-4' : ''
      }`}
    >
      {profile.avatar_url ? (
        <Image
          src={profile.avatar_url}
          alt={displayName}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : size === 80 ? (
        <DefaultAvatar size={80} className="rounded-full" />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-semibold text-fg-secondary">
          {getInitial(displayName)}
        </div>
      )}
    </div>
  );
}
