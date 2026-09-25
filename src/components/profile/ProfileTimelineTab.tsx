'use client';

import { Suspense, useCallback, useState } from 'react';
import type { ScalableProfile } from '@/services/profile/types';
import TimelineView from '@/components/timeline/TimelineView';
import { useAuth } from '@/hooks/useAuth';

interface ProfileTimelineTabProps {
  profile: ScalableProfile;
  isOwnProfile?: boolean;
}

/**
 * ProfileTimelineTab Component
 *
 * Displays timeline for profile pages.
 * - Shows posts that appear on this profile's timeline (subject_id = profile.id)
 * - Signed-in users get the composer on any profile's timeline. A visitor
 *   gets none: a "Sign in to post" box above someone else's feed was the
 *   first thing a stranger read on every profile.
 * - Reuses TimelineView component (DRY)
 */
export default function ProfileTimelineTab({ profile, isOwnProfile }: ProfileTimelineTabProps) {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePostCreated = useCallback(() => {
    // Trigger timeline refresh by updating key
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <div className="w-full px-0 sm:px-4 sm:max-w-2xl sm:mx-auto space-y-0 sm:space-y-4">
      <Suspense fallback={<TimelineLoadingSkeleton />}>
        <TimelineView
          key={refreshKey}
          feedType="profile"
          ownerId={profile.id}
          ownerType="profile"
          showComposer={!!user}
          compact={false}
          showFilters={false}
          emptyStateTitle="No posts yet"
          emptyStateDescription={
            isOwnProfile ? 'Share your first update!' : 'No posts on this timeline yet.'
          }
          onPostCreated={handlePostCreated}
        />
      </Suspense>
    </div>
  );
}

/**
 * Loading skeleton for timeline
 */
function TimelineLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-surface-base border border-default rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-surface-raised rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-surface-raised rounded w-1/4" />
              <div className="h-4 bg-surface-raised rounded w-3/4" />
              <div className="h-4 bg-surface-raised rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
