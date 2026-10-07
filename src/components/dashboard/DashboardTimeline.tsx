'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { CardDescription, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import TimelineComponent from '@/components/timeline/TimelineComponent';
import { TimelineFeedResponse } from '@/types/timeline';
import { ArrowRight, MessageSquare, Compass, RefreshCw, AlertCircle } from 'lucide-react';
import { TimelinePostSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/config/routes';

const PREVIEW_LIMIT = 3;

interface DashboardTimelineProps {
  timelineFeed: TimelineFeedResponse | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onPostSuccess: () => void;
  userId?: string;
}

/**
 * DashboardTimeline — recent-activity preview surface for the dashboard.
 *
 * Renders at most three most-recent timeline events with a "View full
 * timeline" CTA. The composer and the full feed live on the dedicated
 * /timeline page; this surface exists so the dashboard can glance at what's
 * new without surrendering the whole page to the social feed.
 */
export function DashboardTimeline({
  timelineFeed,
  isLoading,
  error,
  onRefresh,
  // onPostSuccess kept on the prop type for parent compatibility; composing
  // moved to /timeline so we don't fire it from here anymore.
  onPostSuccess: _onPostSuccess,
  userId: _userId,
}: DashboardTimelineProps) {
  const previewFeed = useMemo<TimelineFeedResponse | null>(() => {
    if (!timelineFeed) {
      return null;
    }
    if (timelineFeed.events.length <= PREVIEW_LIMIT) {
      return timelineFeed;
    }
    return { ...timelineFeed, events: timelineFeed.events.slice(0, PREVIEW_LIMIT) };
  }, [timelineFeed]);

  const totalEvents = timelineFeed?.events.length ?? 0;
  const hiddenCount = Math.max(0, totalEvents - PREVIEW_LIMIT);

  return (
    <div className="oc-surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
        <div>
          <CardTitle className="text-base font-semibold text-fg-primary sm:text-lg">
            Recent activity
          </CardTitle>
          <CardDescription className="text-xs text-fg-secondary sm:text-sm">
            Latest posts and updates from your network
          </CardDescription>
        </div>
        <Link href={ROUTES.TIMELINE} className="shrink-0">
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            View full timeline
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="p-0">
        {isLoading ? (
          <div className="px-4 py-3 sm:px-0 sm:py-4">
            {[...Array(PREVIEW_LIMIT)].map((_, idx) => (
              <TimelinePostSkeleton key={idx} />
            ))}
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-status-negative sm:px-6 sm:py-10">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 sm:mb-4 sm:h-12 sm:w-12" />
            <p className="mb-2 text-sm font-medium sm:text-base">Failed to load timeline</p>
            <p className="mb-3 text-xs text-fg-secondary sm:mb-4 sm:text-sm">{error}</p>
            <Button variant="outline" onClick={onRefresh} size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : previewFeed && previewFeed.events.length > 0 ? (
          <>
            <TimelineComponent feed={previewFeed} showFilters={false} compact />
            {hiddenCount > 0 && (
              <div className="border-t border-subtle px-4 py-3 text-center sm:px-5">
                <Link
                  href={ROUTES.TIMELINE}
                  className="text-sm font-medium text-fg-secondary hover:text-fg-primary"
                >
                  {hiddenCount} more {hiddenCount === 1 ? 'update' : 'updates'} on the full timeline
                  <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="px-4 py-8 text-center text-fg-secondary sm:py-12">
            <MessageSquare className="mx-auto mb-3 h-12 w-12 text-fg-tertiary sm:mb-4 sm:h-16 sm:w-16 dark:text-fg-secondary" />
            <h3 className="mb-2 text-base font-semibold text-fg-primary sm:text-lg">
              Nothing new yet
            </h3>
            <p className="mx-auto mb-4 max-w-md text-xs text-fg-secondary sm:mb-6 sm:text-sm">
              Posts from your network land here. Share an update on the timeline to get started.
            </p>
            <div className="flex flex-col justify-center gap-2 sm:flex-row sm:gap-3">
              <Button
                href={`${ROUTES.TIMELINE}?compose=true`}
                size="sm"
                className="w-full sm:w-auto"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Share your first post
              </Button>
              <Button
                href={ROUTES.DISCOVER}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
              >
                <Compass className="mr-2 h-4 w-4" />
                Explore community
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardTimeline;
