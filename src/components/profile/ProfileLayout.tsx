'use client';

import { useAuth } from '@/hooks/useAuth';
import type { ScalableProfile } from '@/services/profile/types';
import { ProfileFormData, Project } from '@/types/database';
import ProfileViewTabs from '@/components/profile/ProfileViewTabs';
import ProfileOverviewTab from '@/components/profile/ProfileOverviewTab';
import ProfileTimelineTab from '@/components/profile/ProfileTimelineTab';
import ProfileProjectsTab from '@/components/profile/ProfileProjectsTab';
import ProfilePeopleTab from '@/components/profile/ProfilePeopleTab';
import ProfileInfoTab from '@/components/profile/ProfileInfoTab';
import ProfileWalletsTab from '@/components/profile/ProfileWalletsTab';
import ProfileEntityTab from '@/components/profile/ProfileEntityTab';
import { Users, User, MessageSquare, Globe, ExternalLink, Info, Wallet } from 'lucide-react';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import type { EntityType } from '@/config/entity-registry';
import { cn } from '@/lib/utils';
import { useProfileActions } from './useProfileActions';
import { ProfileBannerSection } from './ProfileBannerSection';
import { MAKER_STATUS_METADATA, isMakerStatus } from '@/config/maker-status';

// Entity types displayed as generic ProfileEntityTab tabs, in order.
const PROFILE_ENTITY_TABS: EntityType[] = [
  'product',
  'service',
  'cause',
  'event',
  'loan',
  'asset',
  'ai_assistant',
];

const ENTITY_TAB_IDS = new Set(
  PROFILE_ENTITY_TABS.map(entityType =>
    ENTITY_REGISTRY[entityType].namePlural.toLowerCase().replace(/\s+/g, '-')
  )
);

interface ProfileLayoutProps {
  profile: ScalableProfile;
  projects?: Project[];
  stats?: {
    projectCount: number;
    totalRaised: number;
    followerCount?: number;
    followingCount?: number;
    walletCount?: number;
    entityCounts?: Partial<Record<EntityType, number>>;
  };
  mode?: 'view' | 'edit';
  onSave?: (data: ProfileFormData) => Promise<void>;
  onModeChange?: (mode: 'view' | 'edit') => void;
  className?: string;
  /** Server-side own-profile detection (avoids hydration flash) */
  serverIsOwnProfile?: boolean;
}

export default function ProfileLayout({
  profile,
  projects,
  stats,
  mode: _mode = 'view',
  onSave,
  onModeChange: _onModeChange,
  className,
  serverIsOwnProfile,
}: ProfileLayoutProps) {
  const { user } = useAuth();
  const isOwnProfile = serverIsOwnProfile ?? profile.id === user?.id;

  const {
    showShare,
    setShowShare,
    isFollowing,
    isFollowLoading,
    shareButtonRef,
    shareDropdownRef,
    handleFollowToggle,
    resolvedHandleProfileSave,
  } = useProfileActions({ profile, isOwnProfile, onSave });

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <User className="w-4 h-4" />,
      content: (
        <ProfileOverviewTab
          profile={profile}
          projects={projects}
          stats={stats}
          isOwnProfile={isOwnProfile}
          context="public"
        />
      ),
    },
    {
      id: 'info',
      label: 'Info',
      icon: <Info className="w-4 h-4" />,
      content: (
        <ProfileInfoTab
          profile={profile as import('@/types/database').Profile & { email?: string | null }}
          isOwnProfile={isOwnProfile}
          userId={user?.id}
          userEmail={user?.email}
          onSave={resolvedHandleProfileSave}
        />
      ),
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: <MessageSquare className="w-4 h-4" />,
      content: <ProfileTimelineTab profile={profile} isOwnProfile={isOwnProfile} />,
    },
    {
      id: 'projects',
      label: ENTITY_REGISTRY['project'].namePlural,
      icon: (() => {
        const Icon = ENTITY_REGISTRY['project'].icon;
        return <Icon className="w-4 h-4" />;
      })(),
      badge: stats?.projectCount,
      content: <ProfileProjectsTab profile={profile} isOwnProfile={isOwnProfile} />,
    },
    ...PROFILE_ENTITY_TABS.map(entityType => {
      const meta = ENTITY_REGISTRY[entityType];
      const Icon = meta.icon;
      return {
        id: meta.namePlural.toLowerCase().replace(/\s+/g, '-'),
        label: meta.namePlural,
        icon: <Icon className="w-4 h-4" />,
        badge: stats?.entityCounts?.[entityType],
        content: (
          <ProfileEntityTab profile={profile} entityType={entityType} isOwnProfile={isOwnProfile} />
        ),
      };
    }),
    {
      id: 'people',
      label: 'People',
      icon: <Users className="w-4 h-4" />,
      badge: stats?.followerCount,
      content: <ProfilePeopleTab profile={profile} isOwnProfile={isOwnProfile} />,
    },
    {
      id: 'wallets',
      label: 'Wallets',
      icon: <Wallet className="w-4 h-4" />,
      badge: stats?.walletCount,
      content: <ProfileWalletsTab profile={profile} isOwnProfile={isOwnProfile} />,
    },
  ];

  const filteredTabs = tabs.filter(tab => {
    if (isOwnProfile) {
      return true;
    }
    if (ENTITY_TAB_IDS.has(tab.id)) {
      return (tab.badge || 0) > 0;
    }
    if (tab.id === 'projects') {
      return (stats?.projectCount || 0) > 0;
    }
    if (tab.id === 'people') {
      return (stats?.followerCount || 0) + (stats?.followingCount || 0) > 0;
    }
    if (tab.id === 'wallets') {
      return (
        (stats?.walletCount || 0) > 0 || !!profile.bitcoin_address || !!profile.lightning_address
      );
    }
    return true;
  });

  return (
    <div className={cn('min-h-screen bg-surface-page', className)}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        <ProfileBannerSection
          profile={profile}
          isOwnProfile={isOwnProfile}
          isFollowing={isFollowing}
          isFollowLoading={isFollowLoading}
          showShare={showShare}
          shareButtonRef={shareButtonRef}
          shareDropdownRef={shareDropdownRef}
          onShareToggle={() => setShowShare(prev => !prev)}
          onFollowToggle={handleFollowToggle}
        />

        <div className="mt-12 sm:mt-16 md:mt-20">
          <div className="oc-surface mb-4 p-4 sm:mb-6 sm:p-6">
            <h1 className="mb-1 break-words text-xl font-bold text-fg-primary sm:mb-2 sm:text-2xl md:text-3xl">
              {profile.name || profile.username || 'User'}
            </h1>
            <p className="mb-3 break-all text-sm font-medium text-fg-secondary sm:mb-4 sm:text-base md:text-lg">
              @{profile.username}
            </p>
            {isMakerStatus(profile.current_status) && (
              <span className="mb-3 inline-flex items-center rounded-full bg-surface-raised border border-default px-2.5 py-1 text-xs font-medium text-fg-primary sm:mb-4">
                {MAKER_STATUS_METADATA[profile.current_status].label}
              </span>
            )}
            {profile.bio && (
              // Surface the bio in the header card so the "who is this" answer
              // is immediate, reinforcing the Overview-first default below.
              // Clamp to 3 lines so a long bio doesn't push tabs off-screen —
              // the Overview tab still has the full text.
              <p className="mb-3 line-clamp-3 max-w-3xl text-sm text-fg-secondary sm:mb-4 sm:text-base">
                {profile.bio}
              </p>
            )}
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-fg-primary hover:text-fg-primary font-medium underline-offset-4 hover:underline"
              >
                <Globe className="w-4 h-4 mr-2" />
                Visit Website
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            )}
          </div>

          {/* Overview-first: a shared profile should open on the scannable
              "who is this / what do they offer" summary, not the timeline feed. */}
          <ProfileViewTabs tabs={filteredTabs} defaultTab="overview" />
        </div>
      </div>
    </div>
  );
}
