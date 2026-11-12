'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { timelineService } from '@/services/timeline';
import { TimelineDisplayEvent, TimelineFeedResponse } from '@/types/timeline';
import { logger } from '@/utils/logger';
import { filterOptimisticEvents } from '@/utils/timeline';
import { useInvalidateTimeline } from '@/hooks/useTimelineQuery';
import { useSocialTimelineSearch } from './useSocialTimelineSearch';

export type SocialTimelineMode = 'timeline' | 'community' | 'following';

/**
 * Whether a feed needs a signed-in reader. `timeline` and `following` are the
 * reader's own feeds. The community feed reads `community_timeline_no_duplicates`
 * — public posts only, granted to anon — and /community is a public route the
 * footer links to, so a signed-out visitor reads it too; only posting waits for
 * sign-in. It used to bounce them to a "Please sign in" wall instead.
 */
export function feedNeedsSignIn(mode: SocialTimelineMode): boolean {
  return mode !== 'community';
}

export interface UseSocialTimelineProps {
  mode: SocialTimelineMode;
  defaultSort?: 'recent' | 'trending' | 'popular';
  onOptimisticUpdate?: (event: TimelineDisplayEvent) => void;
}

export function useSocialTimeline({
  mode,
  defaultSort = 'trending',
  onOptimisticUpdate,
}: UseSocialTimelineProps) {
  const { user, isLoading, hydrated } = useAuth();
  const authCheckComplete = hydrated && !isLoading;

  const { invalidateAll: invalidateTimelineCache } = useInvalidateTimeline();
  const [timelineFeed, setTimelineFeed] = useState<TimelineFeedResponse | null>(null);
  const [optimisticEvents, setOptimisticEvents] = useState<TimelineDisplayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'trending' | 'popular'>(defaultSort);

  const search = useSocialTimelineSearch();

  const handleOptimisticUpdate = useCallback(
    (event: TimelineDisplayEvent) => {
      setOptimisticEvents(prev => [event, ...prev]);
      onOptimisticUpdate?.(event);
    },
    [onOptimisticUpdate]
  );

  const mergedFeed = useMemo(() => {
    if (!timelineFeed) {
      return null;
    }
    const filteredOptimistic = filterOptimisticEvents(optimisticEvents, timelineFeed.events);
    return {
      ...timelineFeed,
      events: [...filteredOptimistic, ...timelineFeed.events],
      metadata: {
        ...timelineFeed.metadata,
        totalEvents: filteredOptimistic.length + timelineFeed.events.length,
      },
    };
  }, [timelineFeed, optimisticEvents]);

  const loadTimelineFeed = useCallback(
    async (sort: string = defaultSort, page: number = 1) => {
      if (feedNeedsSignIn(mode) && !user?.id) {
        return;
      }

      try {
        if (page === 1) {
          setLoading(true);
        } else {
          setIsLoadingMore(true);
        }
        setError(null);

        let feed: TimelineFeedResponse;
        if (mode === 'community') {
          feed = await timelineService.getCommunityFeed(
            { sortBy: sort as 'recent' | 'trending' | 'popular' },
            { page, limit: 20 }
          );
        } else if (!user?.id) {
          return;
        } else if (mode === 'timeline') {
          feed = await timelineService.getEnrichedUserFeed(user.id, {}, { page, limit: 20 });
        } else {
          feed = await timelineService.getEnrichedFollowingFeed(user.id, {}, { page, limit: 20 });
        }

        if (page === 1) {
          setTimelineFeed(feed);
        } else {
          setTimelineFeed(prev => {
            if (!prev) {
              return feed;
            }
            return { ...feed, events: [...prev.events, ...feed.events] };
          });
        }
      } catch (err) {
        logger.error(
          `Failed to load ${mode} timeline`,
          err,
          mode === 'timeline' ? 'Journey' : 'Community'
        );
        setError(`Failed to load ${mode === 'timeline' ? 'your journey' : 'community posts'}`);
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [user?.id, mode, defaultSort]
  );

  const handleSortChange = useCallback(
    (newSort: 'recent' | 'trending' | 'popular') => {
      setSortBy(newSort);
      loadTimelineFeed(newSort);
    },
    [loadTimelineFeed]
  );

  const handleEventUpdate = useCallback(
    (eventId: string, updates: Partial<TimelineDisplayEvent>) => {
      if (!timelineFeed) {
        return;
      }
      setTimelineFeed(prev => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          events: prev.events.map((event: TimelineDisplayEvent) =>
            event.id === eventId ? { ...event, ...updates } : event
          ),
        };
      });
    },
    [timelineFeed]
  );

  const handleLoadMore = useCallback(() => {
    if (search.searchResults !== null) {
      return;
    }
    if (!timelineFeed?.pagination.hasNext) {
      return;
    }
    loadTimelineFeed(sortBy, timelineFeed.pagination.page + 1);
  }, [timelineFeed, sortBy, loadTimelineFeed, search.searchResults]);

  // Signed out, wait for the auth check to finish: starting before it would
  // load the community feed twice when a session turns up a moment later.
  const canLoad = Boolean(user?.id) || (!feedNeedsSignIn(mode) && authCheckComplete);

  useEffect(() => {
    if (hydrated && canLoad) {
      loadTimelineFeed();
    }
  }, [hydrated, canLoad, loadTimelineFeed]);

  return {
    user,
    isLoading,
    hydrated,
    authCheckComplete,
    timelineFeed,
    mergedFeed,
    loading,
    isLoadingMore,
    error,
    sortBy,
    ...search,
    loadTimelineFeed,
    handleSortChange,
    handleEventUpdate,
    handleLoadMore,
    handleOptimisticUpdate,
    invalidateTimelineCache,
  };
}
