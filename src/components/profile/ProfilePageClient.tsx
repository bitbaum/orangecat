'use client';

import type { ScalableProfile } from '@/services/profile/types';
import { Project } from '@/types/database';
import ProfileLayout from '@/components/profile/ProfileLayout';
import type { EntityType } from '@/config/entity-registry';
import type { Article } from '@/services/articles/types';
import type { PublicEconomicProfile } from '@/services/cat/economic-profile';
import type { PublicCivicSplit } from '@/components/profile/ProfileCivicSplit';
import type { TrackRecord } from '@/domain/reputation/service';

interface ProfilePageClientProps {
  profile: ScalableProfile;
  projects?: Project[];
  articles?: Article[];
  isOwnProfile?: boolean;
  economicProfile?: PublicEconomicProfile | null;
  /** Their declared civic split, only when they made it public. */
  civicSplit?: PublicCivicSplit | null;
  /** Observed deals and revealed reviews; null hides the section. */
  trackRecord?: TrackRecord | null;
  stats: {
    projectCount: number;
    totalRaised: number;
    followerCount: number;
    followingCount: number;
    walletCount: number;
    entityCounts?: Partial<Record<EntityType, number>>;
  };
}

export default function ProfilePageClient({
  profile,
  projects,
  articles,
  isOwnProfile,
  economicProfile,
  civicSplit,
  trackRecord,
  stats,
}: ProfilePageClientProps) {
  return (
    <ProfileLayout
      profile={profile}
      projects={projects}
      articles={articles}
      stats={stats}
      serverIsOwnProfile={isOwnProfile}
      economicProfile={economicProfile}
      civicSplit={civicSplit}
      trackRecord={trackRecord}
    />
  );
}
