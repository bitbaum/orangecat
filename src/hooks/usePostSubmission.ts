import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '@/utils/logger';
import { TimelineVisibility } from '@/types/timeline';
import type { TimelineDisplayEvent, PostImageMeta } from '@/types/timeline';
import {
  formatPostError,
  submitPost,
  queueOfflinePost,
} from '@/services/timeline/utils/post-composer';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000;

type PostUser = {
  id: string;
  email?: string;
  user_metadata?: { name?: string };
  profile?: { name?: string | null; username?: string | null; avatar_url?: string | null } | null;
};

interface UsePostSubmissionOptions {
  user: PostUser | null;
  content: string;
  subjectType: 'profile' | 'project';
  subjectId: string | undefined;
  visibility: TimelineVisibility;
  selectedProjects: string[];
  parentEventId: string | undefined;
  image: PostImageMeta | undefined;
  onOptimisticUpdate: ((event: TimelineDisplayEvent) => void) | undefined;
  onSuccess: ((event?: TimelineDisplayEvent) => void) | undefined;
  contentValid: boolean;
  enableRetry: boolean;
  clearDraft: () => void;
  onOfflineQueued: () => void;
}

export function usePostSubmission({
  user,
  content,
  subjectType,
  subjectId,
  visibility,
  selectedProjects,
  parentEventId,
  image,
  onOptimisticUpdate,
  onSuccess,
  contentValid,
  enableRetry,
  clearDraft,
  onOfflineQueued,
}: UsePostSubmissionOptions) {
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const canPost = contentValid && !isPosting;

  const successTimer = useRef<NodeJS.Timeout>(undefined);
  const retryTimer = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    return () => {
      clearTimeout(successTimer.current);
      clearTimeout(retryTimer.current);
    };
  }, []);

  const performPost = useCallback(async (): Promise<boolean> => {
    if (!canPost || !user) {
      return false;
    }
    try {
      const result = await submitPost({
        user,
        content,
        subjectType,
        subjectId,
        visibility,
        selectedProjects,
        parentEventId,
        image,
        onOptimisticUpdate,
      });
      if (!result.success) {
        setError(result.error);
        return false;
      }
      clearDraft();
      setPostSuccess(true);
      onSuccess?.(result.event);
      clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setPostSuccess(false), 3000);
      return true;
    } catch (err) {
      setError(formatPostError(err));
      logger.error('Failed to create post', err, 'usePostComposer');
      return false;
    }
  }, [
    canPost,
    user,
    content,
    subjectType,
    subjectId,
    visibility,
    selectedProjects,
    parentEventId,
    image,
    onOptimisticUpdate,
    onSuccess,
    clearDraft,
  ]);

  const handlePost = useCallback(async () => {
    if (!canPost || !user?.id) {
      return;
    }

    if (!navigator.onLine) {
      try {
        await queueOfflinePost({
          user,
          content,
          subjectType,
          subjectId,
          visibility,
          selectedProjects,
          parentEventId,
          image,
          onOptimisticUpdate,
        });
        setError(null);
        setPostSuccess(true);
        onOfflineQueued();
      } catch (err) {
        setError('Failed to save post for offline sending.');
        logger.error('Failed to add to offline queue', err, 'usePostComposer');
      }
      return;
    }

    setIsPosting(true);
    setError(null);

    const success = await performPost();
    setIsPosting(false);

    if (!success && enableRetry && retryCount < MAX_RETRY_ATTEMPTS && navigator.onLine) {
      if (error && error.includes('profile')) {
        logger.warn('Profile verification failed, skipping retry', { error }, 'usePostComposer');
        return;
      }
      setRetryCount(prev => prev + 1);
      clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(
        () => {
          handlePost();
        },
        RETRY_DELAY * (retryCount + 1)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canPost,
    performPost,
    enableRetry,
    retryCount,
    user,
    content,
    visibility,
    selectedProjects,
    subjectType,
    subjectId,
    image,
    onOfflineQueued,
  ]);

  const retry = useCallback(async () => {
    if (!isPosting) {
      await handlePost();
    }
  }, [handlePost, isPosting]);

  const clearError = useCallback(() => setError(null), []);

  const resetSubmission = useCallback(() => {
    setError(null);
    setPostSuccess(false);
    setRetryCount(0);
  }, []);

  return {
    isPosting,
    error,
    postSuccess,
    retryCount,
    canPost,
    setError,
    handlePost,
    retry,
    clearError,
    resetSubmission,
  };
}
