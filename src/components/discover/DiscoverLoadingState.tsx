'use client';

import {
  ProjectCardSkeleton,
  ProfileCardSkeleton,
  LoanCardSkeleton,
} from '@/components/ui/Skeleton';
import type { DiscoverTabType } from './DiscoverTabs';
import type { ViewMode } from './AnimatedGrid';

interface DiscoverLoadingStateProps {
  viewMode: ViewMode;
  activeTab: DiscoverTabType;
}

export function DiscoverLoadingState({ viewMode, activeTab }: DiscoverLoadingStateProps) {
  return (
    <div
      className="space-y-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-loading="true"
      aria-label="Loading discovery results"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-48 bg-surface-raised rounded animate-pulse" />
      </div>
      <div
        className={`grid gap-6 ${
          viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
        }`}
      >
        {activeTab === 'profiles' ? (
          Array.from({ length: 6 }).map((_, i) => (
            <ProfileCardSkeleton key={i} viewMode={viewMode} />
          ))
        ) : activeTab === 'projects' ? (
          Array.from({ length: 6 }).map((_, i) => <ProjectCardSkeleton key={i} />)
        ) : activeTab === 'loans' || activeTab === 'investments' ? (
          Array.from({ length: 6 }).map((_, i) => <LoanCardSkeleton key={i} viewMode={viewMode} />)
        ) : (
          <>
            {Array.from({ length: 2 }).map((_, i) => (
              <ProjectCardSkeleton key={`project-${i}`} />
            ))}
            {Array.from({ length: 2 }).map((_, i) => (
              <ProfileCardSkeleton key={`profile-${i}`} viewMode={viewMode} />
            ))}
            {Array.from({ length: 2 }).map((_, i) => (
              <LoanCardSkeleton key={`loan-${i}`} viewMode={viewMode} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
