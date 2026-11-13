'use client';

import { useState, useEffect, useCallback } from 'react';
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { timelineService } from '@/services/timeline';
import { TimelineFeedResponse, TimelineDisplayEvent } from '@/types/timeline';
import { logger } from '@/utils/logger';
import { filterOptimisticEvents } from '@/utils/timeline';

interface UseTimelineViewParams {
  feedType: 'journey' | 'community' | 'profile' | 'project';
  ownerId?: string;
  onPostCreated?: () => void;
  onOptimisticEvent?: (event: TimelineDisplayEvent) => void;
}

export function useTimelineView({
  feedType,
  ownerId,
  onPostCreated,
  onOptimisticEvent,
}: UseTimelineViewParams) {
  const { user, isLoading: authLoading, hydrated } = useAuth();
  const [feed, setFeed] = useState<TimelineFeedResponse | null>(null);
  const [optimisticEvents, setOptimisticEvents] = useState<TimelineDisplayEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleOptimisticEvent = useCallback(
    (event: TimelineDisplayEvent) => {
      setOptimisticEvents(prev => [event, ...prev]);
      onOptimisticEvent?.(event);
    },
    [onOptimisticEvent]
  );

  const removeOptimisticEvent = useCallback((optimisticId: string) => {
    setOptimisticEvents(prev => prev.filter(event => event.id !== optimisticId));
  }, []);

  const mergedEvents = React.useMemo(() => {
    if (!feed?.events) {
      return optimisticEvents;
    }
    const filteredOptimistic = filterOptimisticEvents(optimisticEvents, feed.events);
    return [...filteredOptimistic, ...feed.events];
  }, [feed?.events, optimisticEvents]);

  const mergedFeed = React.useMemo(() => {
    if (!feed) {
      return null;
    }
    return {
      ...feed,
      events: mergedEvents,
      metadata: {
        ...feed.metadata,
        totalEvents: mergedEvents.length,
      },
    } as TimelineFeedResponse;
  }, [feed, mergedEvents]);

  useEffect(() => {
    if ((feedType === 'profile' || feedType === 'project') && !ownerId) {
      logger.error(
        `TimelineView: ownerId is required for ${feedType} feed type`,
        null,
        'TimelineView'
      );
      setError(`Invalid configuration: missing ${feedType} ID`);
    }
  }, [feedType, ownerId]);

  const loadFeed = useCallback(
    async (page: number = 1) => {
      if (!hydrated) {
        return;
      }
      if ((feedType === 'profile' || feedType === 'project') && !ownerId) {
        return;
      }
      if (feedType === 'journey' && !user?.id) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        let feedData: TimelineFeedResponse;

        switch (feedType) {
          case 'journey':
            feedData = await timelineService.getEnrichedUserFeed(user!.id, {}, { page, limit: 20 });
            break;
          case 'community':
            feedData = await timelineService.getCommunityFeed({}, { page, limit: 20 });
            break;
          case 'profile':
            feedData = await timelineService.getProfileFeed(ownerId!, {}, { page, limit: 20 });
            break;
          case 'project':
            feedData = await timelineService.getProjectFeed(ownerId!, {}, { page, limit: 20 });
            break;
          default:
            throw new Error(`Unknown feed type: ${feedType}`);
        }

        setFeed(feedData);
      } catch (err) {
        logger.error(`Failed to load ${feedType} timeline`, err, 'TimelineView');
        setError(`Failed to load timeline`);
      } finally {
        setLoading(false);
      }
    },
    [feedType, ownerId, user, hydrated]
  );

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleEventUpdate = useCallback(
    (eventId: string, updates: Partial<TimelineDisplayEvent>) => {
      setFeed(prev => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          events: prev.events
            .map(event => (event.id === eventId ? { ...event, ...updates } : event))
            .filter(event => !event.isDeleted),
        };
      });
    },
    []
  );

  const handleLoadMore = useCallback(() => {
    if (!feed?.pagination.hasNext) {
      return;
    }
    loadFeed(feed.pagination.page + 1);
  }, [feed, loadFeed]);

  const handlePostCreated = useCallback(() => {
    loadFeed(1);
    onPostCreated?.();
  }, [loadFeed, onPostCreated]);

  return {
    user,
    authLoading,
    hydrated,
    feed,
    loading,
    error,
    mergedFeed,
    loadFeed,
    handleEventUpdate,
    handleLoadMore,
    handlePostCreated,
    handleOptimisticEvent,
    removeOptimisticEvent,
  };
}
