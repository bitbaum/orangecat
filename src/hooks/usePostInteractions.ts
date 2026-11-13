'use client';

import { TimelineDisplayEvent } from '@/types/timeline';
import { useAuth } from '@/hooks/useAuth';
import { usePostLikeDislike } from '@/hooks/usePostLikeDislike';
import { usePostRepost } from '@/hooks/usePostRepost';

interface UsePostInteractionsProps {
  event: TimelineDisplayEvent;
  onUpdate: (updates: Partial<TimelineDisplayEvent>) => void;
  onAddEvent?: (event: TimelineDisplayEvent) => void;
}

interface UsePostInteractionsReturn {
  isLiking: boolean;
  handleLike: () => Promise<void>;
  isDisliking: boolean;
  handleDislike: () => Promise<void>;
  isReposting: boolean;
  repostModalOpen: boolean;
  handleRepostClick: () => void;
  handleRepostClose: () => void;
  handleSimpleRepost: () => Promise<void>;
  handleQuoteRepost: (quoteText: string) => Promise<void>;
}

export function usePostInteractions({
  event,
  onUpdate,
  onAddEvent,
}: UsePostInteractionsProps): UsePostInteractionsReturn {
  const { user } = useAuth();

  const likeDislike = usePostLikeDislike({ event, onUpdate });
  const repost = usePostRepost({ event, onAddEvent, userId: user?.id });

  return { ...likeDislike, ...repost };
}
