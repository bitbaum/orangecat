'use client';

import { useAuth } from '@/hooks/useAuth';
import type { ScalableProfile } from '@/services/profile/types';
import { ProfileFormData, Project } from '@/types/database';
import ProfileViewTabs from '@/components/profile/ProfileViewTabs';
import { PRIMARY_PROFILE_TAB_IDS } from '@/components/profile/profileTabLayout';
import ProfileOverviewTab from '@/components/profile/ProfileOverviewTab';
import ProfileTimelineTab from '@/components/profile/ProfileTimelineTab';
import ProfileProjectsTab from '@/components/profile/ProfileProjectsTab';
import ProfilePeopleTab from '@/components/profile/ProfilePeopleTab';
import ProfileInfoTab from '@/components/profile/ProfileInfoTab';
import ProfileWalletsTab from '@/components/profile/ProfileWalletsTab';
import ProfileEntityTab from '@/components/profile/ProfileEntityTab';
import ProfileArticlesTab from '@/components/profile/ProfileArticlesTab';
import ProfileOfferings from '@/components/profile/ProfileOfferings';
import type { PublicEconomicProfile } from '@/services/cat/economic-profile';
import { Users, User, MessageSquare, Info, Wallet, FileText } from 'lucide-react';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import type { EntityType } from '@/config/entity-registry';
import type { Article } from '@/services/articles/types';
import { cn } from '@/lib/utils';
import { useProfileActions } from './useProfileActions';
import { ProfileBannerSection } from './ProfileBannerSection';
import { ProfileActions } from './ProfileActions';
import { ProfileIdentityMeta } from './ProfileIdentityMeta';
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
  articles?: Article[];
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
  /** The Cat's extracted "what I can offer" signals for this profile. */
  economicProfile?: PublicEconomicProfile | null;
}

export default function ProfileLayout({
  profile,
  projects,
  articles,
  stats,
  mode: _mode = 'view',
  onSave,
  onModeChange: _onModeChange,
  className,
  serverIsOwnProfile,
  economicProfile,
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
      id: 'articles',
      label: 'Articles',
      icon: <FileText className="w-4 h-4" />,
      badge: articles?.length || undefined,
      content: <ProfileArticlesTab articles={articles ?? []} isOwnProfile={isOwnProfile} />,
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
    // Info is the owner's field-by-field view (with "Not filled out yet" rows);
    // what a visitor needs from it is in the header line and on Overview.
    if (tab.id === 'info') {
      return false;
    }
    if (ENTITY_TAB_IDS.has(tab.id)) {
      return (tab.badge || 0) > 0;
    }
    if (tab.id === 'projects') {
      return (stats?.projectCount || 0) > 0;
    }
    if (tab.id === 'articles') {
      return (articles?.length || 0) > 0;
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
        <ProfileBannerSection profile={profile} />

        <div className="mt-3 sm:mt-4">
          {/* The avatar overhangs this card. On a phone the top padding clears
              it and the actions sit full-width between the bio and the
              offerings (flex order); from sm up the
              actions row comes first, right-aligned beside the avatar, and its
              own height clears the overhang. */}
          <div className="oc-surface mb-4 flex flex-col p-4 pt-12 sm:mb-6 sm:p-6 sm:pt-4">
            <ProfileActions
              className="order-1 mt-4 w-full sm:order-first sm:mb-2 sm:mt-0 sm:w-auto sm:self-end lg:mb-6"
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
            <h1 className="mb-1 break-words text-xl font-bold text-fg-primary sm:text-2xl md:text-3xl">
              {profile.name || profile.username || 'User'}
            </h1>
            <ProfileIdentityMeta profile={profile} />
            {isMakerStatus(profile.current_status) && (
              <span className="mt-3 inline-flex w-fit items-center rounded-full border border-default bg-surface-raised px-2.5 py-1 text-xs font-medium text-fg-primary">
                {MAKER_STATUS_METADATA[profile.current_status].label}
              </span>
            )}
            {profile.bio && (
              // The bio lives here, once. Overview used to repeat it in an
              // "About" card directly under this one.
              <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-fg-secondary sm:mt-4 sm:text-base">
                {profile.bio}
              </p>
            )}
            <div className="order-2">
              <ProfileOfferings economicProfile={economicProfile} isOwnProfile={isOwnProfile} />
            </div>
          </div>

          {/* Overview-first. Timeline-first (#420) assumed the feed was people's
              activity; on a builder's profile it is mostly automated project
              updates, so a visitor landed on a log. Overview answers "who is
              this and what can I do here"; Timeline is one tap away. */}
          <ProfileViewTabs
            tabs={filteredTabs}
            defaultTab="overview"
            primaryTabIds={PRIMARY_PROFILE_TAB_IDS}
          />
        </div>
      </div>
    </div>
  );
}
