'use client';

import { useCallback, useEffect, useState } from 'react';
import { timelineService } from '@/services/timeline';
import { isAutomatedPublish } from '@/config/external-publish';
import { TimelineFeedResponse } from '@/types/timeline';
import { logger } from '@/utils/logger';

/**
 * The dashboard's "From people on OrangeCat" preview is the first social proof
 * a newcomer meets. Someone else's automated build updates (Loki's "e2e ok —
 * no changes") read as a CI log there, so they are left out; the viewer's own
 * stay, and everyone's remain on the project's wall and the full timeline.
 */
export function withoutOthersAutomatedPublishes(
  feed: TimelineFeedResponse,
  viewerId: string
): TimelineFeedResponse {
  const events = feed.events.filter(
    event => event.actorId === viewerId || !isAutomatedPublish(event.metadata)
  );
  return events.length === feed.events.length ? feed : { ...feed, events };
}

interface UseDashboardTimelineOptions {
  userId: string | undefined;
  hydrated: boolean;
}

export function useDashboardTimeline({ userId, hydrated }: UseDashboardTimelineOptions) {
  const [timelineFeed, setTimelineFeed] = useState<TimelineFeedResponse | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const loadTimelineFeed = useCallback(async (id: string) => {
    setTimelineLoading(true);
    setTimelineError(null);
    try {
      const feed = await timelineService.getEnrichedUserFeed(id);
      setTimelineFeed(feed ? withoutOthersAutomatedPublishes(feed, id) : feed);
      logger.debug(
        'Timeline feed loaded',
        { userId: id, eventCount: feed?.events?.length || 0 },
        'Dashboard'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(
        'Failed to load timeline feed',
        { error: errorMessage, userId: id },
        'Dashboard'
      );
      setTimelineError(`Failed to load timeline: ${errorMessage}`);
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  const reloadTimeline = useCallback(() => {
    if (userId) {
      loadTimelineFeed(userId);
    }
  }, [userId, loadTimelineFeed]);

  useEffect(() => {
    if (userId && hydrated) {
      loadTimelineFeed(userId);
    }
  }, [userId, hydrated, loadTimelineFeed]);

  return { timelineFeed, timelineLoading, timelineError, reloadTimeline };
}
