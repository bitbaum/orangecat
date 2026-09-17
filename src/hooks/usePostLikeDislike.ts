'use client';

import { useState, useCallback } from 'react';
import { TimelineDisplayEvent } from '@/types/timeline';
import { timelineService } from '@/services/timeline';
import { logger } from '@/utils/logger';

interface Props {
  event: TimelineDisplayEvent;
  onUpdate: (updates: Partial<TimelineDisplayEvent>) => void;
}

interface UsePostLikeDislikeReturn {
  isLiking: boolean;
  handleLike: () => Promise<void>;
  isDisliking: boolean;
  handleDislike: () => Promise<void>;
}

export function usePostLikeDislike({ event, onUpdate }: Props): UsePostLikeDislikeReturn {
  const [isLiking, setIsLiking] = useState(false);
  const [isDisliking, setIsDisliking] = useState(false);

  const handleLike = useCallback(async () => {
    if (isLiking) {
      return;
    }

    const originalLiked = !!event.userLiked;
    const originalCount = event.likesCount || 0;
    const nextLiked = !originalLiked;
    const nextCount = Math.max(0, originalCount + (nextLiked ? 1 : -1));

    // Liking retracts a dislike server-side, so the optimistic update has to
    // clear it too — otherwise the post renders as liked AND disliked until a
    // reload, with a dislike count that no longer has a row behind it.
    const wasDisliked = !!event.userDisliked;
    onUpdate({
      userLiked: nextLiked,
      likesCount: nextCount,
      ...(nextLiked && wasDisliked
        ? {
            userDisliked: false,
            dislikesCount: Math.max(0, (event.dislikesCount || 0) - 1),
          }
        : {}),
    });
    setIsLiking(true);

    try {
      const result = await timelineService.toggleLike(event.id);
      if (result.success) {
        onUpdate({
          userLiked: result.liked,
          likesCount: result.likeCount,
          // The server reports both totals; prefer them over the guess above.
          ...(result.disliked !== undefined ? { userDisliked: result.disliked } : {}),
          ...(result.dislikeCount !== undefined ? { dislikesCount: result.dislikeCount } : {}),
        });
      } else {
        onUpdate({
          userLiked: originalLiked,
          likesCount: originalCount,
          userDisliked: wasDisliked,
          dislikesCount: event.dislikesCount || 0,
        });
      }
    } catch (error) {
      logger.error('Failed to toggle like', error, 'usePostLikeDislike');
      onUpdate({ userLiked: originalLiked, likesCount: originalCount });
    } finally {
      setIsLiking(false);
    }
  }, [
    event.id,
    event.userLiked,
    event.likesCount,
    event.userDisliked,
    event.dislikesCount,
    isLiking,
    onUpdate,
  ]);

  const handleDislike = useCallback(async () => {
    if (isDisliking) {
      return;
    }

    const originalDisliked = !!event.userDisliked;
    const originalCount = event.dislikesCount || 0;
    const nextDisliked = !originalDisliked;
    const nextCount = Math.max(0, originalCount + (nextDisliked ? 1 : -1));

    // Mirror image of handleLike: a dislike retracts a like.
    const wasLiked = !!event.userLiked;
    onUpdate({
      userDisliked: nextDisliked,
      dislikesCount: nextCount,
      ...(nextDisliked && wasLiked
        ? {
            userLiked: false,
            likesCount: Math.max(0, (event.likesCount || 0) - 1),
          }
        : {}),
    });
    setIsDisliking(true);

    try {
      const result = await timelineService.toggleDislike(event.id);
      if (result.success) {
        onUpdate({
          userDisliked: result.disliked,
          dislikesCount: result.dislikeCount,
          ...(result.liked !== undefined ? { userLiked: result.liked } : {}),
          ...(result.likeCount !== undefined ? { likesCount: result.likeCount } : {}),
        });
      } else {
        onUpdate({
          userDisliked: originalDisliked,
          dislikesCount: originalCount,
          userLiked: wasLiked,
          likesCount: event.likesCount || 0,
        });
      }
    } catch (error) {
      logger.error('Failed to toggle dislike', error, 'usePostLikeDislike');
      onUpdate({ userDisliked: originalDisliked, dislikesCount: originalCount });
    } finally {
      setIsDisliking(false);
    }
  }, [
    event.id,
    event.userDisliked,
    event.dislikesCount,
    event.userLiked,
    event.likesCount,
    isDisliking,
    onUpdate,
  ]);

  return { isLiking, handleLike, isDisliking, handleDislike };
}
