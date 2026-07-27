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
    return (
      <Card className="p-4 oc-card-link">
        <div className="flex items-center gap-4">
          <Link href={ROUTES.PROFILES.VIEW(profile.username || profile.id)}>
            <div className="relative w-12 h-12 rounded-full overflow-hidden bg-surface-raised flex-shrink-0">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={displayName}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-fg-secondary font-semibold">
                  {getInitial(displayName)}
                </div>
              )}
            </div>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link href={ROUTES.PROFILES.VIEW(profile.username || profile.id)}>
                <h3 className="font-semibold text-fg-primary hover:underline underline-offset-4 truncate">
                  {displayName}
                </h3>
              </Link>
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

          <div className="flex-shrink-0">
            <Link href={ROUTES.PROFILES.VIEW(profile.username || profile.id)}>
              <Button size="sm" variant="outline">
                <ExternalLink className="w-3 h-3 mr-1" />
                View Profile
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  // Grid view
  return (
    <Card className="h-full p-6 oc-card-link">
      <div className="text-center">
        <Link href={ROUTES.PROFILES.VIEW(profile.username || profile.id)}>
          <div className="relative w-20 h-20 rounded-full overflow-hidden bg-surface-raised mx-auto mb-4">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={displayName}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <DefaultAvatar size={80} className="rounded-full" />
            )}
          </div>
        </Link>

        <div className="flex items-center justify-center gap-2 mb-2">
          <Link href={ROUTES.PROFILES.VIEW(profile.username || profile.id)}>
            <h3 className="font-semibold text-fg-primary hover:underline underline-offset-4">
              {displayName}
            </h3>
          </Link>
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

        <Link href={ROUTES.PROFILES.VIEW(profile.username || profile.id)}>
          <Button size="sm" variant="outline" className="w-full">
            <ExternalLink className="w-3 h-3 mr-1" />
            View Profile
          </Button>
        </Link>
      </div>
    </Card>
  );
}
