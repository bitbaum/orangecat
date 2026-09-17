'use client';

import { useState, useCallback } from 'react';
import { TimelineDisplayEvent } from '@/types/timeline';
import { timelineService } from '@/services/timeline';
import { logger } from '@/utils/logger';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface Props {
  event: TimelineDisplayEvent;
  onAddEvent?: (event: TimelineDisplayEvent) => void;
  userId: string | undefined;
}

interface UsePostRepostReturn {
  isReposting: boolean;
  repostModalOpen: boolean;
  handleRepostClick: () => void;
  handleRepostClose: () => void;
  handleSimpleRepost: () => Promise<void>;
  handleQuoteRepost: (quoteText: string) => Promise<void>;
}

export function usePostRepost({ event, onAddEvent, userId }: Props): UsePostRepostReturn {
  const [isReposting, setIsReposting] = useState(false);
  const [repostModalOpen, setRepostModalOpen] = useState(false);

  const handleRepostClick = useCallback(() => {
    if (!userId) {
      return;
    }
    setRepostModalOpen(true);
  }, [userId]);

  const handleRepostClose = useCallback(() => setRepostModalOpen(false), []);

  const handleSimpleRepost = useCallback(async () => {
    if (isReposting || !userId) {
      return;
    }

    setIsReposting(true);
    try {
      const result = await timelineService.createEvent({
        eventType: 'status_update',
        actorId: userId,
        subjectType: 'profile',
        subjectId: userId,
        title: '',
        description: '',
        visibility: 'public',
        metadata: {
          is_repost: true,
          original_event_id: event.id,
          original_actor_id: event.actor.id,
          original_actor_name: event.actor.name,
          original_actor_username: event.actor.username,
          original_actor_avatar: event.actor.avatar,
          original_description: event.description || '',
        },
        parentEventId: event.id,
      });

      if (result.success) {
        logger.info('Successfully reposted event', null, 'usePostRepost');
        if (result.event && onAddEvent) {
          onAddEvent(result.event as unknown as TimelineDisplayEvent);
        }
        setRepostModalOpen(false);
      } else {
        logger.error('Failed to repost event', result.error, 'usePostRepost');
        throw new Error(apiErrorMessage(result, 'Failed to repost'));
      }
    } catch (error) {
      logger.error('Error reposting event', error, 'usePostRepost');
      throw error;
    } finally {
      setIsReposting(false);
    }
  }, [
    event.id,
    event.actor.id,
    event.actor.name,
    event.actor.username,
    event.actor.avatar,
    event.description,
    isReposting,
    userId,
    onAddEvent,
  ]);

  const handleQuoteRepost = useCallback(
    async (quoteText: string) => {
      if (isReposting || !userId || !quoteText.trim()) {
        return;
      }

      setIsReposting(true);
      try {
        const result = await timelineService.createEvent({
          eventType: 'status_update',
          actorId: userId,
          subjectType: 'profile',
          subjectId: userId,
          title: '',
          description: quoteText.trim(),
          visibility: 'public',
          metadata: {
            is_quote_repost: true,
            is_repost: true,
            original_event_id: event.id,
            original_actor_id: event.actor.id,
            original_actor_name: event.actor.name,
            original_actor_username: event.actor.username,
            original_actor_avatar: event.actor.avatar,
            original_description:
              event.metadata &&
              typeof event.metadata === 'object' &&
              'original_description' in event.metadata &&
              typeof event.metadata.original_description === 'string'
                ? event.metadata.original_description
                : event.description || '',
            quote_text: quoteText.trim(),
          },
          parentEventId: event.id,
        });

        if (result.success) {
          logger.info('Successfully quote reposted event', null, 'usePostRepost');
          if (result.event && onAddEvent) {
            onAddEvent(result.event as unknown as TimelineDisplayEvent);
          }
          setRepostModalOpen(false);
        } else {
          logger.error('Failed to quote repost event', result.error, 'usePostRepost');
          throw new Error(apiErrorMessage(result, 'Failed to quote repost'));
        }
      } catch (error) {
        logger.error('Error quote reposting event', error, 'usePostRepost');
        throw error;
      } finally {
        setIsReposting(false);
      }
    },
    [
      event.id,
      event.actor.id,
      event.actor.name,
      event.actor.username,
      event.actor.avatar,
      event.description,
      event.metadata,
      isReposting,
      userId,
      onAddEvent,
    ]
  );

  return {
    isReposting,
    repostModalOpen,
    handleRepostClick,
    handleRepostClose,
    handleSimpleRepost,
    handleQuoteRepost,
  };
}
