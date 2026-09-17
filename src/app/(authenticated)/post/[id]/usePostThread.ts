'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from '@/utils/logger';
import { timelineService } from '@/services/timeline';
import { TimelineDisplayEvent } from '@/types/timeline';

export interface UsePostThreadResult {
  mainPost: TimelineDisplayEvent | null;
  parentPosts: TimelineDisplayEvent[];
  replies: TimelineDisplayEvent[];
  isLoading: boolean;
  error: string | null;
  handlePostUpdate: (eventId: string, updates: Partial<TimelineDisplayEvent>) => void;
  handleReplyCreated: () => void;
  handleNestedReplyCreated: (parentId: string, reply: TimelineDisplayEvent) => void;
  handleReplyDeleted: (eventId: string) => void;
}

export function usePostThread(postId: string): UsePostThreadResult {
  const [mainPost, setMainPost] = useState<TimelineDisplayEvent | null>(null);
  const [parentPosts, setParentPosts] = useState<TimelineDisplayEvent[]>([]);
  const [replies, setReplies] = useState<TimelineDisplayEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Monotonic load id — only the most recent post fetch may write state.
  const loadIdRef = useRef(0);

  const updateReplyTree = useCallback(
    (
      items: TimelineDisplayEvent[],
      eventId: string,
      updates: Partial<TimelineDisplayEvent>
    ): TimelineDisplayEvent[] => {
      return items.map(item => {
        if (item.id === eventId) {
          return { ...item, ...updates };
        }
        if (item.replies?.length) {
          return { ...item, replies: updateReplyTree(item.replies, eventId, updates) };
        }
        return item;
      });
    },
    []
  );

  /**
   * Drop a reply from the tree, at any depth, and correct the reply count of
   * whichever branch held it. Deleting a reply used to leave it on screen: the
   * card called an `onDelete` nobody had passed, so the row stayed until a
   * reload — the same shape as deleting the main post.
   */
  const removeFromReplyTree = useCallback(
    (items: TimelineDisplayEvent[], eventId: string): TimelineDisplayEvent[] => {
      return items
        .filter(item => item.id !== eventId)
        .map(item => {
          if (!item.replies?.length) {
            return item;
          }
          const nextReplies = removeFromReplyTree(item.replies, eventId);
          if (nextReplies.length === item.replies.length) {
            return item;
          }
          return { ...item, replies: nextReplies, replyCount: nextReplies.length };
        });
    },
    []
  );

  const appendReplyToTree = useCallback(
    (
      items: TimelineDisplayEvent[],
      parentId: string,
      reply: TimelineDisplayEvent
    ): TimelineDisplayEvent[] => {
      return items.map(item => {
        if (item.id === parentId) {
          const nextReplies = [...(item.replies || []), reply];
          return { ...item, replies: nextReplies, replyCount: nextReplies.length };
        }
        if (item.replies?.length) {
          return { ...item, replies: appendReplyToTree(item.replies, parentId, reply) };
        }
        return item;
      });
    },
    []
  );

  const fetchPost = useCallback(async () => {
    if (!postId) {
      return;
    }
    const myLoadId = ++loadIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await timelineService.getEventById(postId);
      if (myLoadId !== loadIdRef.current) {
        return;
      }
      if (!result.success || !result.event) {
        setError('Post not found');
        return;
      }
      setMainPost(result.event);

      if (result.event.parentEventId) {
        const parents: TimelineDisplayEvent[] = [];
        let currentParentId: string | undefined = result.event.parentEventId;
        for (let i = 0; i < 10 && currentParentId; i++) {
          const parentResult = await timelineService.getEventById(currentParentId);
          if (myLoadId !== loadIdRef.current) {
            return;
          }
          if (parentResult.success && parentResult.event) {
            parents.unshift(parentResult.event);
            currentParentId = parentResult.event.parentEventId;
          } else {
            break;
          }
        }
        setParentPosts(parents);
      }

      const repliesResult = await timelineService.getReplies(postId);
      if (myLoadId !== loadIdRef.current) {
        return;
      }
      if (repliesResult.success && repliesResult.replies) {
        setReplies(repliesResult.replies);
      }
    } catch (err) {
      if (myLoadId !== loadIdRef.current) {
        return;
      }
      logger.error('Error fetching post', err, 'Timeline');
      setError('Failed to load post');
    } finally {
      if (myLoadId === loadIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
    return () => {
      // Bump id so any in-flight load cannot setState after unmount or postId change.
      // Deliberate write to the live ref — not a stale-read of a node, which is what
      // the exhaustive-deps warning is meant to catch.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      loadIdRef.current++;
    };
  }, [fetchPost]);

  const handlePostUpdate = useCallback(
    (eventId: string, updates: Partial<TimelineDisplayEvent>) => {
      if (eventId === mainPost?.id) {
        setMainPost(prev => (prev ? { ...prev, ...updates } : null));
      } else {
        setReplies(prev => updateReplyTree(prev, eventId, updates));
        setParentPosts(prev => prev.map(p => (p.id === eventId ? { ...p, ...updates } : p)));
      }
    },
    [mainPost?.id, updateReplyTree]
  );

  const handleReplyCreated = useCallback(() => {
    fetchPost();
  }, [fetchPost]);

  const handleNestedReplyCreated = useCallback(
    (parentId: string, reply: TimelineDisplayEvent) => {
      setReplies(prev => appendReplyToTree(prev, parentId, reply));
    },
    [appendReplyToTree]
  );

  const handleReplyDeleted = useCallback(
    (eventId: string) => {
      setReplies(prev => removeFromReplyTree(prev, eventId));
    },
    [removeFromReplyTree]
  );

  return {
    mainPost,
    parentPosts,
    replies,
    isLoading,
    error,
    handlePostUpdate,
    handleReplyCreated,
    handleNestedReplyCreated,
    handleReplyDeleted,
  };
}
