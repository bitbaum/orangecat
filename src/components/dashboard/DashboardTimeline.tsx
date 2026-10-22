'use client';

import { useMemo } from 'react';
import Button from '@/components/ui/Button';
import TimelineComponent from '@/components/timeline/TimelineComponent';
import { TimelineFeedResponse } from '@/types/timeline';
import { TimelinePostSkeleton } from '@/components/ui/Skeleton';
import { DashboardSection } from './sections/DashboardSection';
import { ROUTES } from '@/config/routes';

const PREVIEW_LIMIT = 3;

interface DashboardTimelineProps {
  timelineFeed: TimelineFeedResponse | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function DashboardTimeline({
  timelineFeed,
  isLoading,
  error,
  onRefresh,
}: DashboardTimelineProps) {
  const previewFeed = useMemo(
    () =>
      timelineFeed
        ? {
            ...timelineFeed,
            events: timelineFeed.events.slice(0, PREVIEW_LIMIT),
          }
        : null,
    [timelineFeed]
  );

  return (
    <DashboardSection
      id="dashboard-activity"
      title="Recent activity"
      action={{ label: 'View timeline', href: ROUTES.TIMELINE }}
    >
      <div className="overflow-hidden rounded-lg border border-default bg-surface-base">
        {isLoading ? (
          <div aria-label="Loading recent activity">
            {Array.from({ length: PREVIEW_LIMIT }, (_, index) => (
              <TimelinePostSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <div className="space-y-3 p-4">
            <p role="status" className="text-sm text-fg-secondary">
              Recent activity could not be loaded.
            </p>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Try again
            </Button>
          </div>
        ) : previewFeed && previewFeed.events.length > 0 ? (
          <TimelineComponent
            feed={previewFeed}
            showFilters={false}
            showEndMessage={false}
            compact
          />
        ) : (
          <p className="p-4 text-sm text-fg-secondary">
            Posts and project updates from your network will appear here.
          </p>
        )}
      </div>
    </DashboardSection>
  );
}

export default DashboardTimeline;
