'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { TimelineDisplayEvent, TimelineVisibility } from '@/types/timeline';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';
import { logger } from '@/utils/logger';
import { timelineService } from '@/services/timeline';
import { usePostInteractions } from '@/hooks/usePostInteractions';
import { submitReplyAction } from './postCardReplyAction';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface UsePostCardActionsParams {
  event: TimelineDisplayEvent;
  user: User | null | undefined;
  profile: Profile | null | undefined;
  onUpdate: (updates: Partial<TimelineDisplayEvent>) => void;
  /** Where a post created from this card goes — see usePostRepost. */
  onAddEvent?: (event: TimelineDisplayEvent) => void;
  onDelete?: () => void;
  onReplyCreated?: (reply: TimelineDisplayEvent) => void;
  isSelectionMode?: boolean;
  onToggleSelect?: (eventId: string) => void;
}

export function usePostCardActions({
  event,
  user,
  profile,
  onUpdate,
  onAddEvent,
  onDelete,
  onReplyCreated,
  isSelectionMode = false,
  onToggleSelect,
}: UsePostCardActionsParams) {
  const router = useRouter();

  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    isReposting,
    repostModalOpen,
    handleRepostClick,
    handleRepostClose,
    handleSimpleRepost,
    handleQuoteRepost,
    // Without onAddEvent, usePostRepost's success path skips handing the new
    // post back (`if (result.event && onAddEvent)`), so a quote repost was
    // created and then existed nowhere on screen until a reload.
  } = usePostInteractions({ event, onUpdate, onAddEvent });

  const canEdit = user?.id === event.actor.id;

  const handleMenuToggle = useCallback(() => setShowMenu(prev => !prev), []);

  const handleEditClick = useCallback(() => {
    setShowMenu(false);
    setShowEditModal(true);
  }, []);

  const handleEditSave = useCallback(
    async (updates: { title: string; description: string; visibility: TimelineVisibility }) => {
      setIsEditing(true);
      try {
        const result = await timelineService.updateEvent(event.id, {
          title: updates.title,
          description: updates.description,
          visibility: updates.visibility,
        });
        if (result.success) {
          onUpdate({
            title: updates.title,
            description: updates.description,
            visibility: updates.visibility,
            updatedAt: new Date().toISOString(),
          });
          logger.info('Post updated successfully', { eventId: event.id }, 'PostCard');
        } else {
          throw new Error(apiErrorMessage(result, 'Failed to update post'));
        }
      } catch (error) {
        logger.error('Failed to update post', error, 'PostCard');
        throw error;
      } finally {
        setIsEditing(false);
      }
    },
    [event.id, onUpdate]
  );

  const handleDeleteClick = useCallback(() => {
    setShowMenu(false);
    setShowDeleteDialog(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    setIsDeleting(true);
    try {
      const success = await timelineService.deleteEvent(event.id);
      if (success) {
        logger.info('Post deleted successfully', { eventId: event.id }, 'PostCard');
        setShowDeleteDialog(false);
        onDelete?.();
      } else {
        throw new Error('Failed to delete post');
      }
    } catch (error) {
      logger.error('Failed to delete post', error, 'PostCard');
      throw error;
    } finally {
      setIsDeleting(false);
    }
  }, [event.id, onDelete]);

  const handleToggleReply = useCallback(() => setShowReplyInput(prev => !prev), []);

  const handleReplySubmit = useCallback(
    () =>
      submitReplyAction({
        replyText,
        isReplying,
        user,
        event,
        setIsReplying,
        setReplyText,
        setShowReplyInput,
        onReplyCreated,
        onUpdate,
      }),
    [replyText, isReplying, user, event, onReplyCreated, onUpdate]
  );

  const handleSelectionClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleSelect?.(event.id);
    },
    [event.id, onToggleSelect]
  );

  const handlePostClick = useCallback(
    (e: React.MouseEvent) => {
      if (isSelectionMode) {
        onToggleSelect?.(event.id);
        return;
      }
      const target = e.target as HTMLElement;
      if (target.closest('a, button, textarea, input, [role="button"]')) {
        return;
      }
      router.push(`/post/${event.id}`);
    },
    [router, event.id, isSelectionMode, onToggleSelect]
  );

  return {
    canEdit,
    showReplyInput,
    replyText,
    setReplyText,
    isReplying,
    showMenu,
    showEditModal,
    setShowEditModal,
    showDeleteDialog,
    setShowDeleteDialog,
    isEditing,
    isDeleting,
    isReposting,
    repostModalOpen,
    handleMenuToggle,
    handleEditClick,
    handleEditSave,
    handleDeleteClick,
    handleDeleteConfirm,
    handleToggleReply,
    handleReplySubmit,
    handleSelectionClick,
    handlePostClick,
    handleRepostClick,
    handleRepostClose,
    handleSimpleRepost,
    handleQuoteRepost,
    profile,
  };
}
