'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Calendar, MapPin, Globe, Tag } from 'lucide-react';
import type { ScalableProfile } from '@/services/profile/types';
import Button from '@/components/ui/Button';
import { EntityType } from '@/config/entity-registry';
import { getStatusInfo, NORMAL_VISIBLE_STATUSES } from '@/config/status-config';
import { useProfileEntityTab, getRelativeTime } from './useProfileEntityTab';
import { formatDate } from '@/utils/dates';

interface ProfileEntityTabProps {
  profile: ScalableProfile;
  entityType: EntityType;
  isOwnProfile?: boolean;
}

export default function ProfileEntityTab({
  profile,
  entityType,
  isOwnProfile,
}: ProfileEntityTabProps) {
  const {
    entities,
    metadata,
    loading,
    Icon,
    displayName,
    getDashboardPath,
    getCreatePath,
    getViewPath,
    getTitle,
    getThumbnail,
    getPriceDisplay,
  } = useProfileEntityTab(profile, entityType);

  if (loading) {
    return (
      <div className="text-fg-secondary text-base py-8 text-center">Loading {displayName}...</div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="text-center py-12">
        <Icon className="w-16 h-16 mx-auto mb-4 text-fg-tertiary dark:text-fg-secondary" />
        <h3 className="text-lg font-semibold text-fg-primary mb-2">No {displayName} Yet</h3>
        <p className="text-fg-secondary text-base mb-6">
          {isOwnProfile
            ? `You haven't published any ${displayName.toLowerCase()} yet`
            : `No ${displayName.toLowerCase()} to display`}
        </p>
        {isOwnProfile && (
          <Link href={getCreatePath()}>
            <Button>
              <Icon className="w-4 h-4 mr-2" />
              Create Your First {metadata?.name || entityType}
            </Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-fg-primary flex items-center gap-2">
          <Icon className="w-5 h-5 text-fg-secondary" />
          {entities.length} {entities.length === 1 ? metadata?.name : metadata?.namePlural}
        </h3>
        {isOwnProfile && (
          <Link href={getDashboardPath()}>
            <Button variant="ghost" size="sm">
              Manage All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {entities.map(entity => {
          const statusInfo = getStatusInfo(entity.status || '', entityType);
          const thumbnail = getThumbnail(entity);
          const showStatusBadge =
            entity.status &&
            !NORMAL_VISIBLE_STATUSES.includes(
              entity.status.toLowerCase() as (typeof NORMAL_VISIBLE_STATUSES)[number]
            );

          return (
            <Link
              key={entity.id}
              href={getViewPath(entity.id)}
              className="block overflow-hidden rounded-lg border-2 border-default hover:border-strong hover:shadow-sm bg-surface-base transition-all duration-200 group"
            >
              <div className="flex flex-col sm:flex-row">
                <div className="relative w-full sm:w-32 h-32 sm:h-auto flex-shrink-0 bg-surface-raised">
                  {thumbnail ? (
                    <Image
                      src={thumbnail}
                      alt={getTitle(entity)}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon className="w-10 h-10 text-fg-tertiary" />
                    </div>
                  )}
                  {entity.category && (
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-1 bg-surface-base/90 dark:bg-surface-base/90 backdrop-blur-sm rounded-md text-xs font-medium text-fg-primary">
                        {entity.category}
                      </span>
                    </div>
                  )}
                  {showStatusBadge && (
                    <div className="absolute top-2 right-2">
                      <span
                        className={`px-2 py-1 rounded-md text-xs font-medium ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 p-4 sm:p-5 flex flex-col">
                  <div className="flex-1">
                    <h4 className="font-bold text-fg-primary text-lg mb-1.5 line-clamp-1">
                      {getTitle(entity)}
                    </h4>
                    {entity.description && (
                      <p className="text-base text-fg-secondary line-clamp-2 mb-3">
                        {entity.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-fg-secondary mb-3">
                    {entityType === 'event' && entity.start_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(entity.start_date)}
                      </span>
                    )}
                    {entityType === 'event' && (entity.venue_city || entity.is_online) && (
                      <span className="flex items-center gap-1">
                        {entity.is_online ? (
                          <>
                            <Globe className="w-4 h-4" />
                            Online
                          </>
                        ) : (
                          <>
                            <MapPin className="w-4 h-4" />
                            {entity.venue_city}
                          </>
                        )}
                      </span>
                    )}
                    {entityType === 'asset' && entity.type && (
                      <span className="flex items-center gap-1">
                        <Tag className="w-4 h-4" />
                        {entity.type}
                      </span>
                    )}
                    {getPriceDisplay(entity) && (
                      <span className="font-semibold text-fg-primary">
                        {getPriceDisplay(entity)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-fg-secondary pt-2 border-t border-subtle">
                    <span>{getRelativeTime(entity.created_at)}</span>
                    {entityType === 'asset' && entity.verification_status === 'verified' && (
                      <span className="text-status-positive font-medium">Verified</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
