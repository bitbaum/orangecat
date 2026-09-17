import { useState, useCallback, useEffect, useMemo } from 'react';
import { logger } from '@/utils/logger';
import { useAuth } from '@/hooks/useAuth';
import type { TimelineVisibility, TimelineDisplayEvent, PostImageMeta } from '@/types/timeline';
import { usePostDraft } from '@/hooks/usePostDraft';
import { fetchUserProjects, type UserProject } from '@/services/timeline/utils/post-composer';
import { usePostSubmission } from './usePostSubmission';
import { TIMELINE_CONTENT_LIMITS } from '@/config/timeline';

export interface PostComposerOptions {
  subjectType?: 'profile' | 'project';
  subjectId?: string;
  allowProjectSelection?: boolean;
  defaultVisibility?: TimelineVisibility;
  onSuccess?: (event?: TimelineDisplayEvent) => void;
  onOptimisticUpdate?: (event: TimelineDisplayEvent) => void;
  debounceMs?: number;
  enableDrafts?: boolean;
  enableRetry?: boolean;
  maxLength?: number;
  /** Parent event ID for replies/comments */
  parentEventId?: string;
}

interface PostComposerState {
  content: string;
  setContent: (content: string) => void;
  visibility: TimelineVisibility;
  setVisibility: (visibility: TimelineVisibility) => void;
  selectedProjects: string[];
  setSelectedProjects: (projects: string[]) => void;
  image: PostImageMeta | null;
  setImage: (image: PostImageMeta | null) => void;
  userProjects: UserProject[];
  loadingProjects: boolean;
  isPosting: boolean;
  error: string | null;
  postSuccess: boolean;
  retryCount: number;
  characterCount: number;
  isValid: boolean;
  canPost: boolean;
  handlePost: () => Promise<void>;
  toggleProjectSelection: (projectId: string) => void;
  reset: () => void;
  clearError: () => void;
  retry: () => Promise<void>;
}

export function usePostComposer(options: PostComposerOptions = {}): PostComposerState {
  const { user } = useAuth();
  const {
    subjectType = 'profile',
    subjectId,
    allowProjectSelection = false,
    defaultVisibility = 'public',
    onSuccess,
    onOptimisticUpdate,
    debounceMs = 300,
    enableDrafts = true,
    enableRetry = true,
    maxLength = TIMELINE_CONTENT_LIMITS.post,
    parentEventId,
  } = options;

  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<TimelineVisibility>(defaultVisibility || 'public');
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [image, setImage] = useState<PostImageMeta | null>(null);
  const [userProjects, setUserProjects] = useState<UserProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const draftSetters = useMemo(() => ({ setContent, setVisibility, setSelectedProjects }), []);
  const { clearDraft } = usePostDraft(
    { subjectType, subjectId, enableDrafts, debounceMs, defaultVisibility },
    { content, visibility, selectedProjects },
    draftSetters
  );

  useEffect(() => {
    if (!allowProjectSelection || !user?.id) {
      return;
    }
    setLoadingProjects(true);
    fetchUserProjects(user.id)
      .then(projects => {
        setUserProjects(projects);
        setLoadingProjects(false);
      })
      .catch(err => {
        setLoadingProjects(false);
        logger.error('Failed to load user projects', err, 'usePostComposer');
      });
  }, [allowProjectSelection, user?.id]);

  const characterCount = content.length;
  const isValid = content.trim().length > 0 && characterCount <= maxLength;
  const contentValid = isValid && !loadingProjects;

  const clearFormState = useCallback(() => {
    setContent('');
    setSelectedProjects([]);
    setImage(null);
  }, []);

  /**
   * Empty the composer once the post exists.
   *
   * This did not happen. A successful post called `clearDraft()`, which
   * discards the SAVED draft, and nothing called `clearFormState()`, which is
   * the one that owns `content` — so the text you had just posted stayed in the
   * box. Pressing post again then hit the server's duplicate guard ("You just
   * posted this"), which read as the button being broken rather than as having
   * already worked. `clearFormState` was reachable only from the offline path
   * and from `reset()`, neither of which a normal successful post touches.
   *
   * It belongs here rather than in usePostSubmission: this hook owns `content`,
   * and submission should not have to know how to empty someone else's state.
   */
  const handleSubmitted = useCallback(
    (event?: unknown) => {
      clearFormState();
      onSuccess?.(event as never);
    },
    [clearFormState, onSuccess]
  );

  const {
    isPosting,
    error,
    postSuccess,
    retryCount,
    canPost,
    handlePost,
    retry,
    clearError,
    resetSubmission,
  } = usePostSubmission({
    user,
    content,
    subjectType,
    subjectId,
    visibility,
    selectedProjects,
    parentEventId,
    image: image ?? undefined,
    onOptimisticUpdate,
    onSuccess: handleSubmitted,
    contentValid,
    enableRetry,
    clearDraft,
    onOfflineQueued: clearFormState,
  });

  const handleSetContent = useCallback(
    (newContent: string) => {
      setContent(newContent);
      if (error) {
        clearError();
      }
    },
    [error, clearError]
  );

  const reset = useCallback(() => {
    clearFormState();
    resetSubmission();
    clearDraft();
  }, [clearFormState, resetSubmission, clearDraft]);

  const toggleProjectSelection = useCallback((projectId: string) => {
    setSelectedProjects(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  }, []);

  return {
    content,
    setContent: handleSetContent,
    visibility,
    setVisibility,
    selectedProjects,
    setSelectedProjects,
    image,
    setImage,
    userProjects,
    loadingProjects,
    isPosting,
    error,
    postSuccess,
    retryCount,
    characterCount,
    isValid,
    canPost,
    handlePost,
    toggleProjectSelection,
    reset,
    clearError,
    retry,
  };
}
