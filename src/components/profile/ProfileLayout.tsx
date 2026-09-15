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
import {
  Users,
  User,
  MessageSquare,
  Globe,
  ExternalLink,
  Info,
  Wallet,
  FileText,
  Calendar,
} from 'lucide-react';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import type { EntityType } from '@/config/entity-registry';
import type { Article } from '@/services/articles/types';
import { cn } from '@/lib/utils';
import { useProfileActions } from './useProfileActions';
import { ProfileBannerSection } from './ProfileBannerSection';
import { MAKER_STATUS_METADATA, isMakerStatus } from '@/config/maker-status';
import { APP_LOCALE } from '@/utils/locale';

const JOINED_DATE_FORMATTER = new Intl.DateTimeFormat(APP_LOCALE, {
  month: 'short',
  year: 'numeric',
});

/** "Joined Aug 2026" — quiet identity metadata, not a headline stat. */
function formatJoinedDate(createdAt: string): string | null {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? null : JOINED_DATE_FORMATTER.format(date);
}

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
  const joinedDate = profile.created_at ? formatJoinedDate(profile.created_at) : null;

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

        <div className="mt-3 sm:mt-4">
          {/* Top padding clears the avatar's overhang (half its height) plus a
              gap, so the avatar overlaps this card the way it overlaps the
              banner — one continuous header rather than two boxes with a
              portrait stranded in the white space between them. */}
          <div className="oc-surface mb-4 p-4 pt-12 sm:mb-6 sm:p-6 sm:pt-14 md:pt-16 lg:pt-20">
            <h1 className="mb-1 break-words text-xl font-bold text-fg-primary sm:mb-2 sm:text-2xl md:text-3xl">
              {profile.name || profile.username || 'User'}
            </h1>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:mb-4">
              <p className="break-all text-sm font-medium text-fg-secondary sm:text-base md:text-lg">
                @{profile.username}
              </p>
              {joinedDate && (
                <span className="inline-flex items-center gap-1 text-xs text-fg-tertiary">
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  Joined {joinedDate}
                </span>
              )}
            </div>
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
            <ProfileOfferings economicProfile={economicProfile} isOwnProfile={isOwnProfile} />
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

          {/* Timeline-first: open on the living activity feed so visitors see the
              latest — new projects, funding, updates — the way an X profile does,
              rather than a static summary. Overview remains one tap away. */}
          <ProfileViewTabs
            tabs={filteredTabs}
            defaultTab="timeline"
            primaryTabIds={PRIMARY_PROFILE_TAB_IDS}
          />
        </div>
      </div>
    </div>
  );
}
